/**
 * The G-03 durable job store (server-only).
 *
 * Jobs live in the SAME LibSQL file as the matters (lib/matters/database-url
 * is the single source for the URL): one app DB, no new infra. The queue
 * table is additive — existing matter data and its access path are untouched.
 *
 * Reuse sources (named in the PR body), both from dcolley/tourbillon@7a8595b:
 * - packages/db/src/chat-task-queries.ts claimChatTaskRun — the claim is a
 *   CAS: UPDATE ... WHERE status='queued' AND attempts<max, with the attempt
 *   increment and the lease stamp in the SAME statement, so a claim cannot
 *   double-fire and a lost race simply returns no row.
 * - packages/db/src/chat-task-queries.ts reconcileStaleChatTaskRuns — on
 *   boot (and every pump) a running row whose lease has lapsed is the
 *   process that died mid-run: attempts left → back to 'queued' for a fresh
 *   attempt, budget spent → parked 'failed'. The pack passes a staleCutoff;
 *   here the lease expiry is the liveness rule, trimmed to ChatLegal's
 *   single-process world.
 * - packages/db/src/migrations/0023_chat_tasks.sql — the shape of the table:
 *   plain additive SQL with a status CHECK and a claim index, applied once
 *   through a minimal migration runner (the app had none: the table rows
 *   themselves are the migration ledger's first entries).
 *
 * The raw driver is @libsql/client — the same driver @mastra/libsql (the
 * matters store's own engine, lib/matters/store.ts) runs on, opened against
 * the same file. Raw SQL is how a queue needs to talk anyway: CAS updates,
 * RETURNING, and a busy timeout are below the storage-adapter surface.
 */

import { createClient, type Client } from '@libsql/client'
import { ensureMattersDatabaseDirectory, mattersDatabaseAuthToken } from '../matters/database-url'
import type { TaskRunnerJob, TaskRunStatus } from './queue'

export const TASK_RUNNER_JOBS_TABLE = 'task_runner_jobs'
export const TASK_RUNNER_SCHEMA_TABLE = 'chatlegal_schema_migrations'

/** Raw row as stored (snake_case, delivered as 0/1). */
type JobRow = {
  id: string
  user_id: string
  matter_id: string
  title: string
  brief: string
  status: string
  attempts: number
  delivered: number
  summary: string | null
  note: string | null
  lease_owner: string | null
  lease_expires_at: string | null
  claim_token: string | null
  created_at: string
  started_at: string | null
  finished_at: string | null
}

/** A job the caller holds: the row plus the token its settle must present. */
export type ClaimedJob = {
  job: TaskRunnerJob
  claimToken: string
}

export type TaskRunnerDb = {
  /** Open + migrate. Every operation awaits it, so users need not. */
  ready: Promise<void>
  close: () => Promise<void>
  insertJob: (job: TaskRunnerJob) => Promise<void>
  selectJob: (id: string) => Promise<TaskRunnerJob | undefined>
  /** CAS claim of the oldest claimable job. Undefined when another won. */
  claimNextJob: (input: {
    owner: string
    claimToken: string
    nowIso: string
    leaseExpiresAtIso: string
    maxAttempts: number
  }) => Promise<ClaimedJob | undefined>
  /** Terminal settle, lease-guarded. True when this caller's lease held. */
  settleJob: (input: {
    id: string
    claimToken: string
    status: 'done' | 'failed'
    summary: string
    note?: string
    nowIso: string
  }) => Promise<boolean>
  /** Lease-guarded re-queue for a fresh attempt. True when this caller won. */
  requeueJob: (input: { id: string; claimToken: string; nowIso: string }) => Promise<boolean>
  /** Reconcile leases that lapsed by the cutoff (restart re-pick). */
  reconcileExpiredLeases: (input: {
    /** A running row is dead only if its lease expired by this time. */
    staleCutoffIso: string
    /** Clock for the settle timestamps. */
    nowIso: string
    maxAttempts: number
    failedNote: string
  }) => Promise<{ requeued: number; parked: number }>
  /** Finished, never-reported jobs for one owner+matter, marked delivered. */
  collectUndelivered: (input: { userId: string; matterId: string }) => Promise<TaskRunnerJob[]>
  counts: (input: { nowIso: string }) => Promise<{ queued: number; running: number }>
}

/**
 * The additive migrations. Kept as named, ordered, applied-once scripts —
 * the app had no migration system, and a queue table is the smallest thing
 * that forces one (the brief's "helper migration runner if the app had none
 * yet, minimal and tested").
 */
export const TASK_RUNNER_MIGRATIONS: ReadonlyArray<{ id: string; sql: string }> = [
  {
    id: '0001_task_runner_jobs',
    sql: `
      CREATE TABLE IF NOT EXISTS ${TASK_RUNNER_JOBS_TABLE} (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        matter_id TEXT NOT NULL,
        title TEXT NOT NULL,
        brief TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'running', 'done', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0,
        delivered INTEGER NOT NULL DEFAULT 0,
        summary TEXT,
        note TEXT,
        lease_owner TEXT,
        lease_expires_at TEXT,
        claim_token TEXT,
        created_at TEXT NOT NULL,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE INDEX IF NOT EXISTS task_runner_jobs_claim_idx
        ON ${TASK_RUNNER_JOBS_TABLE} (status, created_at, id);
      CREATE INDEX IF NOT EXISTS task_runner_jobs_deliver_idx
        ON ${TASK_RUNNER_JOBS_TABLE} (user_id, matter_id, status, delivered, created_at);
    `,
  },
]

/** Apply the migrations idempotently; the ledger table is created first. */
export async function ensureTaskRunnerSchema(client: Client): Promise<void> {
  await client.execute(
    `CREATE TABLE IF NOT EXISTS ${TASK_RUNNER_SCHEMA_TABLE} (
       id TEXT PRIMARY KEY NOT NULL,
       applied_at TEXT NOT NULL
     )`,
  )
  const listed = await client.execute(`SELECT id FROM ${TASK_RUNNER_SCHEMA_TABLE}`)
  const applied = new Set(listed.rows.map((row) => String(row.id)))
  for (const migration of TASK_RUNNER_MIGRATIONS) {
    if (applied.has(migration.id)) continue
    // Idempotent DDL (IF NOT EXISTS) + the ledger row: a crash between the
    // two just replays the no-op DDL on the next boot.
    await client.executeMultiple(migration.sql)
    await client.execute({
      sql: `INSERT INTO ${TASK_RUNNER_SCHEMA_TABLE} (id, applied_at) VALUES (?, ?)`,
      args: [migration.id, new Date().toISOString()],
    })
  }
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value
  if (value === null || value === undefined) return ''
  return String(value)
}

function asNullableString(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'string') return value
  return String(value)
}

function asNumber(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toJob(row: JobRow): TaskRunnerJob {
  const job: TaskRunnerJob = {
    id: row.id,
    userId: row.user_id,
    matterId: row.matter_id,
    title: row.title,
    brief: row.brief,
    status: row.status as TaskRunStatus,
    attempts: asNumber(row.attempts),
    delivered: row.delivered === 1,
    createdAt: row.created_at,
  }
  const summary = asNullableString(row.summary)
  if (summary !== null) job.summary = summary
  const note = asNullableString(row.note)
  if (note !== null) job.note = note
  const startedAt = asNullableString(row.started_at)
  if (startedAt !== null) job.startedAt = startedAt
  const finishedAt = asNullableString(row.finished_at)
  if (finishedAt !== null) job.finishedAt = finishedAt
  return job
}

const JOB_COLUMNS = `id, user_id, matter_id, title, brief, status, attempts, delivered,
  summary, note, lease_owner, lease_expires_at, claim_token, created_at, started_at, finished_at`

/**
 * The queue's own view onto the app's LibSQL file. One client per queue,
 * lazy-ready, busy-timed out so the matters store writing on the same file
 * is waited for, not an error.
 */
export function createTaskRunnerDb(input: {
  url: string
  authToken?: string
  /** ms to wait on a write lock before erroring (transient contention). */
  busyTimeoutMs?: number
}): TaskRunnerDb {
  ensureMattersDatabaseDirectory(input.url)
  const authToken = input.authToken ?? mattersDatabaseAuthToken(input.url)
  const client: Client = createClient({
    url: input.url,
    ...(authToken ? { authToken } : {}),
    ...(input.busyTimeoutMs !== undefined ? { timeout: input.busyTimeoutMs } : {}),
  })
  const ready = ensureTaskRunnerSchema(client)

  async function claimUpdate(
    sql: string,
    args: (string | number | null)[],
    tokenFor: () => string,
  ): Promise<ClaimedJob | undefined> {
    const result = await client.execute({ sql, args })
    const row = result.rows[0] as unknown as JobRow | undefined
    if (!row) return undefined
    return { job: toJob(row), claimToken: tokenFor() }
  }

  return {
    ready,
    close: async () => {
      try {
        await ready
      } catch {
        // a failed init leaves nothing to close
      }
      client.close()
    },
    async insertJob(job) {
      await ready
      await client.execute({
        sql: `INSERT INTO ${TASK_RUNNER_JOBS_TABLE} (
            id, user_id, matter_id, title, brief, status, attempts, delivered,
            created_at
          ) VALUES (?, ?, ?, ?, ?, 'queued', 0, 0, ?)`,
        args: [job.id, job.userId, job.matterId, job.title, job.brief, job.createdAt],
      })
    },
    async selectJob(id) {
      await ready
      const result = await client.execute({
        sql: `SELECT ${JOB_COLUMNS} FROM ${TASK_RUNNER_JOBS_TABLE} WHERE id = ?`,
        args: [id],
      })
      const row = result.rows[0] as unknown as JobRow | undefined
      return row ? toJob(row) : undefined
    },
    async claimNextJob(opts) {
      await ready
      // claimChatTaskRun's CAS: the status guard, the attempt budget, the
      // increment, and the lease all ride ONE statement, RETURNING gives the
      // winner its row (and only the winner gets a row back).
      return claimUpdate(
        `UPDATE ${TASK_RUNNER_JOBS_TABLE}
           SET status = 'running',
               attempts = attempts + 1,
               lease_owner = ?,
               lease_expires_at = ?,
               started_at = ?,
               claim_token = ?
         WHERE id = (
           SELECT id FROM ${TASK_RUNNER_JOBS_TABLE}
            WHERE status = 'queued' AND attempts < ?
            ORDER BY created_at ASC, id ASC
            LIMIT 1
         )
           AND status = 'queued'
           AND attempts < ?
         RETURNING ${JOB_COLUMNS}`,
        [opts.owner, opts.leaseExpiresAtIso, opts.nowIso, opts.claimToken, opts.maxAttempts, opts.maxAttempts],
        () => opts.claimToken,
      )
    },
    async settleJob(opts) {
      await ready
      const result = await client.execute({
        sql: `UPDATE ${TASK_RUNNER_JOBS_TABLE}
                SET status = ?, summary = ?, note = ?, finished_at = ?,
                    lease_owner = NULL, lease_expires_at = NULL, claim_token = NULL
              WHERE id = ? AND status = 'running' AND claim_token = ?`,
        args: [
          opts.status,
          opts.summary,
          opts.note ?? null,
          opts.nowIso,
          opts.id,
          opts.claimToken,
        ],
      })
      return result.rowsAffected === 1
    },
    async requeueJob(opts) {
      await ready
      const result = await client.execute({
        sql: `UPDATE ${TASK_RUNNER_JOBS_TABLE}
                SET status = 'queued', started_at = NULL, finished_at = NULL,
                    lease_owner = NULL, lease_expires_at = NULL, claim_token = NULL
              WHERE id = ? AND status = 'running' AND claim_token = ?`,
        args: [opts.id, opts.claimToken],
      })
      return result.rowsAffected === 1
    },
    async reconcileExpiredLeases(opts) {
      await ready
      // The pack's boot-sweep rule (reconcileStaleChatTaskRuns): a running
      // row is dead work only when its lease lapsed by the caller's cutoff
      // — the queue passes its own start time, so a live worker's lease
      // (which outlives the job timeout) is never its own tombstone.
      const listed = await client.execute({
        sql: `SELECT ${JOB_COLUMNS} FROM ${TASK_RUNNER_JOBS_TABLE}
               WHERE status = 'running'
                 AND (lease_expires_at IS NULL OR lease_expires_at <= ?)
               ORDER BY created_at ASC, id ASC`,
        args: [opts.staleCutoffIso],
      })
      let requeued = 0
      let parked = 0
      for (const raw of listed.rows as unknown as JobRow[]) {
        const attempts = asNumber(raw.attempts)
        if (attempts < opts.maxAttempts) {
          // Re-check the lease in the WHERE: a worker that finished between
          // the read and this write keeps its settle (the guard misses).
          const result = await client.execute({
            sql: `UPDATE ${TASK_RUNNER_JOBS_TABLE}
                    SET status = 'queued', started_at = NULL, finished_at = NULL,
                        lease_owner = NULL, lease_expires_at = NULL, claim_token = NULL
                  WHERE id = ? AND status = 'running'
                    AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
            args: [raw.id, opts.staleCutoffIso],
          })
          if (result.rowsAffected === 1) requeued += 1
        } else {
          const result = await client.execute({
            sql: `UPDATE ${TASK_RUNNER_JOBS_TABLE}
                    SET status = 'failed', note = ?, summary = ?, finished_at = ?,
                        lease_owner = NULL, lease_expires_at = NULL, claim_token = NULL
                  WHERE id = ? AND status = 'running'
                    AND (lease_expires_at IS NULL OR lease_expires_at <= ?)`,
            args: [opts.failedNote, opts.failedNote, opts.nowIso, raw.id, opts.staleCutoffIso],
          })
          if (result.rowsAffected === 1) parked += 1
        }
      }
      return { requeued, parked }
    },
    async collectUndelivered(opts) {
      await ready
      const listed = await client.execute({
        sql: `SELECT ${JOB_COLUMNS} FROM ${TASK_RUNNER_JOBS_TABLE}
               WHERE user_id = ? AND matter_id = ?
                 AND status IN ('done', 'failed') AND delivered = 0
               ORDER BY created_at ASC, id ASC`,
        args: [opts.userId, opts.matterId],
      })
      const due: TaskRunnerJob[] = []
      for (const row of listed.rows as unknown as JobRow[]) {
        // CAS on delivered: two turns racing report it once, never twice.
        const marked = await client.execute({
          sql: `UPDATE ${TASK_RUNNER_JOBS_TABLE} SET delivered = 1 WHERE id = ? AND delivered = 0`,
          args: [row.id],
        })
        if (marked.rowsAffected === 1) due.push(toJob(row))
      }
      return due
    },
    async counts(opts) {
      await ready
      const result = await client.execute({
        sql: `SELECT
            COALESCE(SUM(CASE WHEN status = 'queued' THEN 1 ELSE 0 END), 0) AS queued,
            COALESCE(SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END), 0) AS running
          FROM ${TASK_RUNNER_JOBS_TABLE}`,
        args: [],
      })
      const row = (result.rows[0] ?? { queued: 0, running: 0 }) as unknown as {
        queued: unknown
        running: unknown
      }
      // opts.nowIso is kept in the signature: a lease-aware count is the
      // first thing a second process would need (documented, not invented).
      void opts
      return { queued: asNumber(row.queued), running: asNumber(row.running) }
    },
  }
}
