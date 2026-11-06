/**
 * The G-03 durable TaskRunner queue (server-only).
 *
 * Same contract as the G-02 in-process queue (lib/task-runner/queue.ts),
 * now over the app's own LibSQL file (lib/task-runner/db.ts): a restart
 * loses nothing. Queued work survives; a job whose worker died mid-run is
 * re-picked from the expired lease on the next pump.
 *
 * Reuse sources (named in the PR body), from dcolley/tourbillon@7a8595b:
 * - packages/scheduler/src/task-runner.ts — the poll/claim loop inside a
 *   bounded budget (never an unlimited parallel stack), the kill switch
 *   (maxConcurrent 0: claim nothing, run nothing, no error), the settle
 *   once semantics, and deps injection (TaskRunnerQueueDeps is this file's
 *   TaskRunnerDeps);
 * - packages/db/src/chat-task-queries.ts — claimChatTaskRun's CAS claim and
 *   reconcileStaleChatTaskRuns's stale-in-flight reclaim, both through
 *   lib/task-runner/db.ts (settle/requeue are lease-guarded by claim_token,
 *   the finishChatTaskRun "only touches in_progress rows" guard, so a slow
 *   worker whose lease was already reclaimed can never overwrite the fresh
 *   outcome).
 *
 * The lease: claiming stamps lease_expires_at = now + leaseMs (the shared
 * queue sets it above the whole-job wall clock, CHATLEGAL_TASKRUNNER_JOB_-
 * TIMEOUT_MS + grace, so a live worker never loses its lease to the
 * reconciler). Two queue instances over one file are safe by the CAS rules
 * even though ChatLegal runs a single process today.
 */

import { randomUUID } from 'node:crypto'
import type { ClaimedJob, TaskRunnerDb } from './db'
import {
  RUN_TASK_CAP,
  TASK_FAILED_NOTE,
  TASK_MAX_ATTEMPTS,
  type TaskRunnerJob,
  type TaskRunnerQueue,
  type TaskRunnerQueueDeps,
  type TaskRunOutcome,
} from './queue'

/** Default poll interval for waitFor (the handoff path's settle wait). */
export const DEFAULT_POLL_MS = 50
/** Default lease TTL; the shared queue derives it from the job timeout. */
export const DEFAULT_LEASE_MS = 150_000

export type DurableQueueOptions = {
  db: TaskRunnerDb
  /** 0 is the kill switch: pump claims nothing, runs nothing, stays quiet. */
  maxConcurrent?: number
  /** Lease owner stamp. Unique per queue instance; tests may pin it. */
  owner?: string
  /** Lease TTL in ms. Keep above the whole-job timeout (see header). */
  leaseMs?: number
  /** waitFor poll interval. */
  pollMs?: number
}

export function createDurableTaskRunnerQueue(
  deps: TaskRunnerQueueDeps,
  options: DurableQueueOptions,
): TaskRunnerQueue {
  const db = options.db
  const maxConcurrent = Math.max(0, Math.floor(options.maxConcurrent ?? RUN_TASK_CAP))
  const owner = options.owner ?? `taskrunner-${randomUUID()}`
  const leaseMs = options.leaseMs ?? DEFAULT_LEASE_MS
  const pollMs = Math.max(1, Math.floor(options.pollMs ?? DEFAULT_POLL_MS))
  const now = deps.now ?? (() => new Date())

  // Strictly monotonic created_at: two enqueues inside one clock tick keep
  // their true order (ORDER BY created_at, id would otherwise fall to the
  // random id). The order is persisted, so FIFO survives a restart too.
  let lastCreatedAt = 0
  function nextCreatedAt(): string {
    const at = Math.max(now().getTime(), lastCreatedAt + 1)
    lastCreatedAt = at
    return new Date(at).toISOString()
  }

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

  // One pump at a time; a pump requested while one runs re-runs after it,
  // so a settle during a claim loop never strands the freed slot.
  let pumping = false
  let pumpRequested = false

  function pump(): void {
    // The kill switch (maxConcurrent 0): queued work stays queued, visibly,
    // and nothing is claimed or started — the documented TaskRunner-pack
    // S3 edge, not an error. No reconcile either: with the switch thrown,
    // the queue touches the table not at all.
    if (maxConcurrent === 0) return
    if (pumping) {
      pumpRequested = true
      return
    }
    pumping = true
    void pumpAsync().finally(() => {
      pumping = false
      if (pumpRequested) {
        pumpRequested = false
        pump()
      }
    })
  }

  async function pumpAsync(): Promise<void> {
    try {
      await db.ready
      const nowIso = now().toISOString()
      // Restart re-pick: leases that lapsed before this process existed
      // (the process that held them died) go back to 'queued' while
      // attempts remain, else park as failed.
      const reconciled = await db.reconcileExpiredLeases({
        staleCutoffIso: bootIso,
        nowIso,
        maxAttempts: TASK_MAX_ATTEMPTS,
        failedNote: TASK_FAILED_NOTE,
      })
      if (reconciled.requeued > 0 || reconciled.parked > 0) {
        log('warn', 'task-run reconcile settled expired leases', reconciled)
      }
      const counts = await db.counts({ nowIso })
      let running = counts.running
      while (running < maxConcurrent) {
        const claimed = await db.claimNextJob({
          owner,
          claimToken: randomUUID(),
          nowIso: now().toISOString(),
          leaseExpiresAtIso: new Date(now().getTime() + leaseMs).toISOString(),
          maxAttempts: TASK_MAX_ATTEMPTS,
        })
        if (!claimed) break
        running += 1
        void runClaimed(claimed)
      }
    } catch (error) {
      // A queue that cannot read its table is deaf, not dead: the error is
      // logged, the process keeps serving chat (safe-fallback style).
      log('error', 'task-run pump failed', { error: String(error) })
    }
  }

  async function runClaimed(claimed: ClaimedJob): Promise<void> {
    const { job, claimToken } = claimed
    const attempt = job.attempts
    log('info', 'task-run started', { taskId: job.id, matterId: job.matterId, attempt })
    let outcome: TaskRunOutcome
    try {
      outcome = await deps.runJob({ id: job.id, title: job.title, brief: job.brief, attempt })
    } catch (error) {
      // The person never sees the error itself (no-dump rule): the note
      // stays server-side, the summary line is the generic TASK_FAILED_NOTE.
      log('error', 'task-run attempt failed', { taskId: job.id, matterId: job.matterId, attempt, error: String(error) })
      outcome = { status: 'failed', summary: TASK_FAILED_NOTE }
    }
    await settleClaimed(job, claimToken, outcome)
  }

  async function settleClaimed(job: TaskRunnerJob, claimToken: string, outcome: TaskRunOutcome): Promise<void> {
    const nowIso = now().toISOString()
    try {
      const text = outcome.summary?.trim() ?? ''
      if (outcome.status === 'done' && text) {
        const won = await db.settleJob({ id: job.id, claimToken, status: 'done', summary: text, nowIso })
        if (won) log('info', 'task-run done', { taskId: job.id, matterId: job.matterId, attempts: job.attempts })
        else log('warn', 'task-run settle lost the lease', { taskId: job.id })
        pump()
        return
      }
      // A blank 'done' is not a deliverable: it parks like G-02 did, without
      // burning the retry budget. A real failure retries while attempts
      // remain (taskRunSettleStatus's re-queue), then parks.
      const retryable = outcome.status === 'failed' && job.attempts < TASK_MAX_ATTEMPTS
      if (retryable) {
        const won = await db.requeueJob({ id: job.id, claimToken, nowIso })
        if (won) {
          log('warn', 'task-run re-queued for a fresh attempt', { taskId: job.id, attempt: job.attempts })
          pump()
        } else {
          log('warn', 'task-run requeue lost the lease', { taskId: job.id })
        }
        return
      }
      const won = await db.settleJob({
        id: job.id,
        claimToken,
        status: 'failed',
        summary: TASK_FAILED_NOTE,
        note: TASK_FAILED_NOTE,
        nowIso,
      })
      if (won) log('info', 'task-run failed', { taskId: job.id, matterId: job.matterId, attempts: job.attempts })
      else log('warn', 'task-run park lost the lease', { taskId: job.id })
      pump()
    } catch (error) {
      log('error', 'task-run settle failed', { taskId: job.id, error: String(error) })
    }
  }

  function isFinished(job: TaskRunnerJob | undefined): boolean {
    return job?.status === 'done' || job?.status === 'failed'
  }

  // Boot pump, the way the pack's poller starts with its loop: a fresh
  // process reconciles crashed leases and claims queued work without
  // waiting for someone to enqueue. The kill switch makes this a no-op.
  //
  // The reconcile cutoff is this instance's start time: a running row is
  // only dead work if its lease lapsed before we existed (the pack's
  // bootTime sweep). A live worker's lease outlives the job timeout, so a
  // queue never reconciles a job it could still be running itself; a
  // wedged in-process worker is cleaned up by the next process boot.
  const bootIso = now().toISOString()
  pump()

  return {
    async enqueue(input) {
      await db.ready
      const job: TaskRunnerJob = {
        id: `task_${randomUUID()}`,
        userId: input.userId,
        matterId: input.matterId,
        title: input.title,
        brief: input.brief,
        status: 'queued',
        attempts: 0,
        delivered: false,
        createdAt: nextCreatedAt(),
      }
      await db.insertJob(job)
      log('info', 'task-run queued', { taskId: job.id, matterId: job.matterId })
      pump()
      return job
    },
    async get(id) {
      await db.ready
      return db.selectJob(id)
    },
    async waitFor(id, timeoutMs) {
      await db.ready
      let job = await db.selectJob(id)
      if (!job) return undefined
      const budget = Math.max(0, Math.floor(timeoutMs))
      if (isFinished(job) || budget === 0) return job
      // Real wall clock for the wait itself: deps.now may be a test clock.
      const startedAt = Date.now()
      while (Date.now() - startedAt < budget) {
        await new Promise<void>((resolve) => setTimeout(resolve, pollMs))
        const latest = await db.selectJob(id)
        if (latest) job = latest
        if (isFinished(job)) return job
      }
      return job
    },
    async collectDeliverable(userId, matterId) {
      await db.ready
      return db.collectUndelivered({ userId, matterId })
    },
    async counts() {
      await db.ready
      return db.counts({ nowIso: now().toISOString() })
    },
  }
}
