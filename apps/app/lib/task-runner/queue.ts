/**
 * The TaskRunner queue contract (server-only).
 *
 * G-02 shipped this as an in-process map with a comment saying durability
 * belongs to G-03. G-03 landed it: the implementation is now
 * lib/task-runner/durable-queue.ts over lib/task-runner/db.ts — jobs live in
 * the app's own LibSQL file, claimed with a lease, and re-picked after a
 * crash. This module keeps what both worlds share: the job/outcome shapes,
 * the budget constants, and the one seam the queue needs to run something.
 *
 * The shape still follows dcolley/tourbillon@7a8595b
 * packages/scheduler/src/task-runner.ts, trimmed to one process and one DB:
 * - a job is claimed and runs inside a bounded budget, not as an unlimited
 *   parallel runner (RUN_TASK_CAP per queue, default 2, mirroring
 *   RUN_TASK_CAP_PER_AGENT; an explicit 0 is the kill switch and the same
 *   documented edge as the TaskRunner pack's S3: jobs stay queued, nothing
 *   is claimed, nothing errors);
 * - all queue I/O goes through TaskRunnerQueueDeps so the poll logic is
 *   unit-testable with fakes, the way TaskRunnerDeps is there;
 * - a finished job settles once: done with a summary, or failed with a
 *   generic note after the attempt budget is spent (taskRunSettleStatus's
 *   retry-then-park, trimmed to 'queued' retry then 'failed');
 * - results reach the parent chat as one high-level progress line, never a
 *   tool transcript (emitProgress in that pack; here: the summary is all
 *   the Concierge ever sees, folded into <task-result> by the prompt layer).
 */

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

/**
 * The queue the routes hand the Concierge. G-03 made every operation
 * database-backed, so they are async now: enqueue persists before pumping,
 * collectDeliverable marks delivered with a CAS so nobody narrates the same
 * outcome twice even across two server turns.
 */
export type TaskRunnerQueue = {
  /** Take a brief and start owning it. Persists the queued job, then pumps. */
  enqueue(input: { userId: string; matterId: string; title: string; brief: string }): Promise<TaskRunnerJob>
  get(id: string): Promise<TaskRunnerJob | undefined>
  /**
   * Poll until the job leaves 'queued'/'running', or timeoutMs passes. The
   * handoff path uses this to narrate inside the turn when the work is
   * quick; a timeout is not a failure — the result rides the next turn
   * through collectDeliverable instead.
   */
  waitFor(id: string, timeoutMs: number): Promise<TaskRunnerJob | undefined>
  /** Not-yet-reported finished jobs, oldest first, marked delivered here. */
  collectDeliverable(userId: string, matterId: string): Promise<TaskRunnerJob[]>
  counts(): Promise<{ queued: number; running: number }>
}
