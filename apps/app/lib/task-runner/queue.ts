/**
 * The G-02 background run queue (server-only).
 *
 * Concierge hands a brief over; this module owns the job from there. The
 * shape is adapted from dcolley/tourbillon@7a8595b
 * packages/scheduler/src/task-runner.ts, trimmed to one process and no DB:
 * - a job is claimed and runs inside a bounded budget, not as an unlimited
 *   parallel runner (RUN_TASK_CAP per queue, default 2, mirroring
 *   RUN_TASK_CAP_PER_AGENT; an explicit 0 is the kill switch and the same
 *   documented edge as the TaskRunner pack's S3: jobs stay queued, nothing errors);
 * - all queue I/O goes through TaskRunnerQueueDeps so the poll logic is
 *   unit-testable with fakes, the way TaskRunnerDeps is there;
 * - a finished job settles once: done with a summary, or failed with a
 *   generic note after the attempt budget is spent (taskRunSettleStatus's
 *   retry-then-park, trimmed to 'queued' retry then 'failed');
 * - results reach the parent chat as one high-level progress line, never a
 *   tool transcript (emitProgress in that pack; here: the summary is all
 *   the Concierge ever sees).
 *
 * Durability is deliberately out of this slice: the queue lives in the
 * server process, so a restart drops queued work — the persistent queue is
 * part of the G-03 tool bus. collectDeliverable marks a result reported
 * the first time it is taken, so nobody narrates the same outcome twice.
 */

import { randomUUID } from 'node:crypto'

export type TaskRunStatus = 'queued' | 'running' | 'done' | 'failed'

/** What the runner side answers with: one status and one plain summary. */
export type TaskRunOutcome = {
  status: 'done' | 'failed'
  summary: string
}

export type TaskRunnerJob = {
  id: string
  userId: string
  matterId: string
  title: string
  brief: string
  status: TaskRunStatus
  attempts: number
  /** True once the Concierge has been given this result to narrate. */
  delivered: boolean
  summary?: string
  note?: string
  createdAt: string
  startedAt?: string
  finishedAt?: string
}

/** The one seam the queue needs to actually run something. */
export type TaskRunnerQueueDeps = {
  /** Run one attempt. It may throw; the queue settles it, never rethrows. */
  runJob: (job: { id: string; title: string; brief: string; attempt: number }) => Promise<TaskRunOutcome>
  /** Injectable clock (tests). */
  now?: () => Date
  /** Optional structured log, same optionality style as TaskRunnerDeps.log. */
  log?: {
    info: (msg: string, data?: Record<string, unknown>) => void
    warn?: (msg: string, data?: Record<string, unknown>) => void
    error?: (msg: string, data?: Record<string, unknown>) => void
  }
}

/** Per-queue ceiling for concurrent runs — mirrors RUN_TASK_CAP_PER_AGENT = 2. */
export const RUN_TASK_CAP = 2
/** Attempts per job before it parks as failed (taskRunSettleStatus's maxAttempts). */
export const TASK_MAX_ATTEMPTS = 2
/** The only failure text a person may ever hear. Internals stay server-side. */
export const TASK_FAILED_NOTE = 'The background check could not be finished this time.'

export type TaskRunnerQueue = {
  /** Take a brief and start owning it. Returns the queued job (already pumping). */
  enqueue(input: { userId: string; matterId: string; title: string; brief: string }): TaskRunnerJob
  get(id: string): TaskRunnerJob | undefined
  /**
   * Settle waiters until the job leaves 'queued'/'running', or timeoutMs
   * passes. The handoff path uses this to narrate inside the turn when the
   * work is quick; a timeout is not a failure — the result rides the next
   * turn through collectDeliverable instead.
   */
  waitFor(id: string, timeoutMs: number): Promise<TaskRunnerJob | undefined>
  /** Not-yet-reported finished jobs, oldest first, marked delivered here. */
  collectDeliverable(userId: string, matterId: string): TaskRunnerJob[]
  counts(): { queued: number; running: number }
}

export function createTaskRunnerQueue(
  deps: TaskRunnerQueueDeps,
  options: { maxConcurrent?: number } = {},
): TaskRunnerQueue {
  const maxConcurrent = Math.max(0, Math.floor(options.maxConcurrent ?? RUN_TASK_CAP))
  const now = deps.now ?? (() => new Date())
  const jobs = new Map<string, TaskRunnerJob>()
  const order: string[] = []
  const waiters = new Map<string, Set<(job: TaskRunnerJob | undefined) => void>>()

  const log = (level: 'info' | 'warn' | 'error', msg: string, data?: Record<string, unknown>) => {
    // Logging must never break the queue (logRunnerActivity's swallow rule).
    try {
      if (level === 'info') deps.log?.info(msg, data)
      else if (level === 'warn') (deps.log?.warn ?? deps.log?.info)?.(msg, data)
      else (deps.log?.error ?? deps.log?.info)?.(msg, data)
    } catch {
      // nothing to do
    }
  }

  function settleWaiters(id: string): void {
    const pending = waiters.get(id)
    if (!pending || pending.size === 0) return
    waiters.delete(id)
    const job = jobs.get(id)
    for (const resolve of pending) resolve(job)
  }

  function runAttempt(job: TaskRunnerJob): void {
    job.status = 'running'
    job.attempts += 1
    job.startedAt = now().toISOString()
    const attempt = job.attempts
    log('info', 'task-run started', { taskId: job.id, matterId: job.matterId, attempt })
    void (async () => {
      try {
        const outcome = await deps.runJob({ id: job.id, title: job.title, brief: job.brief, attempt })
        finish(job, outcome.status, outcome.summary)
      } catch (error) {
        // The person never sees the error itself (no-dump rule): the note
        // stays server-side, the summary line is the generic TASK_FAILED_NOTE.
        log('error', 'task-run attempt failed', { taskId: job.id, matterId: job.matterId, attempt, error: String(error) })
        finish(job, 'failed')
      }
    })()
  }

  function finish(job: TaskRunnerJob, status: 'done' | 'failed', summary?: string): void {
    if (job.status !== 'running') return // a late settle after a reset is ignored
    if (status === 'failed' && job.attempts < TASK_MAX_ATTEMPTS) {
      // Fresh attempt, still pending — taskRunSettleStatus's re-queue.
      job.status = 'queued'
      job.finishedAt = undefined
      log('warn', 'task-run re-queued for a fresh attempt', { taskId: job.id, attempt: job.attempts })
      pump()
      return
    }
    job.status = status === 'done' ? 'done' : 'failed'
    job.finishedAt = now().toISOString()
    if (status === 'done') {
      const text = summary?.trim()
      job.summary = text ? text : TASK_FAILED_NOTE
      if (!text) job.status = 'failed'
    } else {
      job.summary = TASK_FAILED_NOTE
      job.note = TASK_FAILED_NOTE
    }
    log('info', status === 'done' ? 'task-run done' : 'task-run failed', { taskId: job.id, matterId: job.matterId, attempts: job.attempts })
    settleWaiters(job.id)
    pump()
  }

  function pump(): void {
    // The kill switch (maxConcurrent 0): queued work stays queued, visibly,
    // and nothing starts — the documented TaskRunner-pack S3 edge, not an error.
    if (maxConcurrent === 0) return
    let running = 0
    for (const job of jobs.values()) if (job.status === 'running') running += 1
    for (const id of order) {
      if (running >= maxConcurrent) return
      const job = jobs.get(id)
      if (!job || job.status !== 'queued') continue
      runAttempt(job)
      running += 1
    }
  }

  return {
    enqueue(input) {
      const job: TaskRunnerJob = {
        id: `task_${randomUUID()}`,
        userId: input.userId,
        matterId: input.matterId,
        title: input.title,
        brief: input.brief,
        status: 'queued',
        attempts: 0,
        delivered: false,
        createdAt: now().toISOString(),
      }
      jobs.set(job.id, job)
      order.push(job.id)
      pump()
      return job
    },
    get(id) {
      return jobs.get(id)
    },
    async waitFor(id, timeoutMs) {
      const job = jobs.get(id)
      if (!job) return undefined
      if (job.status === 'done' || job.status === 'failed') return job
      const budget = Math.max(0, Math.floor(timeoutMs))
      if (budget === 0) return job
      return new Promise((resolve) => {
        let settled = false
        const done = (value: TaskRunnerJob | undefined) => {
          if (settled) return
          settled = true
          clearTimeout(timer)
          resolve(value)
        }
        const timer = setTimeout(() => done(jobs.get(id)), budget)
        let pending = waiters.get(id)
        if (!pending) {
          pending = new Set()
          waiters.set(id, pending)
        }
        pending.add(done)
      })
    },
    collectDeliverable(userId, matterId) {
      const due: TaskRunnerJob[] = []
      for (const id of order) {
        const job = jobs.get(id)
        if (!job || job.userId !== userId || job.matterId !== matterId) continue
        if ((job.status === 'done' || job.status === 'failed') && !job.delivered) {
          job.delivered = true
          due.push(job)
        }
      }
      return due
    },
    counts() {
      let queued = 0
      let running = 0
      for (const job of jobs.values()) {
        if (job.status === 'queued') queued += 1
        else if (job.status === 'running') running += 1
      }
      return { queued, running }
    },
  }
}
