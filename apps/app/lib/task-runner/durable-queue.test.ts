/**
 * G-03: the TaskRunner queue is durable.
 *
 * These pin what the G-02 in-process queue could not promise: jobs survive
 * a restart. The three the brief names — enqueue → claim → complete, the
 * MAX_CONCURRENT=0 kill switch claiming nothing and running nothing, and
 * restart recovery (crash mid-run → reclaim → finish) — plus the G-02
 * behaviours ported over: the concurrency budget, retry-then-park, the
 * blank-summary rule, once-only delivery, and owner scoping. The CAS claim
 * itself (mirroring Tourbillon's claimChatTaskRun) is pinned directly on
 * the db layer, and the migration runner on a reopened file.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'path'
import { createClient } from '@libsql/client'
import {
  createTaskRunnerDb,
  ensureTaskRunnerSchema,
  TASK_RUNNER_MIGRATIONS,
  TASK_RUNNER_SCHEMA_TABLE,
  type TaskRunnerDb,
} from './db.ts'
import { createDurableTaskRunnerQueue } from './durable-queue.ts'
import {
  RUN_TASK_CAP,
  TASK_FAILED_NOTE,
  TASK_MAX_ATTEMPTS,
  type TaskRunnerJob,
  type TaskRunOutcome,
} from './queue.ts'

const BASE = { userId: 'user_test', matterId: 'matter_1', title: 'Check the dates', brief: 'Work out the deadlines.' }

type Deferred = {
  promise: Promise<void>
  release: () => void
}

function deferred(): Deferred {
  let release = () => {}
  const promise = new Promise<void>((resolve) => {
    release = resolve
  })
  return { promise, release }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function openMemoryDb(): TaskRunnerDb {
  return createTaskRunnerDb({ url: ':memory:' })
}

function openFileDb(): { url: string; close: () => Promise<void> } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-taskdb-'))
  const url = `file:${path.join(dir, 'matters.db')}`
  return {
    url,
    close: async () => {
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

function queueOver(
  db: TaskRunnerDb,
  runJob: (job: { id: string; title: string; brief: string; attempt: number }) => Promise<TaskRunOutcome>,
  options: { maxConcurrent?: number; leaseMs?: number } = {},
) {
  return createDurableTaskRunnerQueue({ runJob }, { db, pollMs: 5, leaseMs: 60_000, ...options })
}

describe('durable queue: enqueue → claim → complete', () => {
  it('runs a job to done out of the table and hands its summary out exactly once', async () => {
    const db = openMemoryDb()
    try {
      const runs: { id: string; title: string; brief: string; attempt: number }[] = []
      const queue = queueOver(db, async (job) => {
        runs.push(job)
        return { status: 'done', summary: 'Two dates collide: 6 April and 3 April.' }
      })
      const job = await queue.enqueue(BASE)
      assert.equal(job.status, 'queued')
      const settled = await queue.waitFor(job.id, 2_000)
      assert.equal(settled?.status, 'done')
      assert.equal(settled?.summary, 'Two dates collide: 6 April and 3 April.')
      assert.equal(settled?.attempts, 1)
      assert.equal(runs.length, 1)
      assert.equal(runs[0]?.attempt, 1)
      assert.equal(runs[0]?.brief, BASE.brief)
      // Reported once, then silent — nobody narrates the same outcome twice.
      const due = await queue.collectDeliverable('user_test', 'matter_1')
      assert.deepEqual(due.map((entry) => entry.id), [job.id])
      assert.deepEqual(await queue.collectDeliverable('user_test', 'matter_1'), [])
      assert.deepEqual(await queue.counts(), { queued: 0, running: 0 })
    } finally {
      await db.close()
    }
  })

  it('the claim is a CAS: one queued row is won by exactly one claimer', async () => {
    const db = openMemoryDb()
    try {
      await db.ready
      const job: TaskRunnerJob = {
        id: 'task_cas_1',
        userId: 'u',
        matterId: 'm',
        title: 't',
        brief: 'b',
        status: 'queued',
        attempts: 0,
        delivered: false,
        createdAt: new Date().toISOString(),
      }
      await db.insertJob(job)
      const first = await db.claimNextJob({
        owner: 'owner-a',
        claimToken: 'token-a',
        nowIso: new Date().toISOString(),
        leaseExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        maxAttempts: TASK_MAX_ATTEMPTS,
      })
      assert.equal(first?.job.id, 'task_cas_1')
      assert.equal(first?.job.status, 'running')
      assert.equal(first?.job.attempts, 1)
      assert.equal(first?.claimToken, 'token-a')
      // The attempt increment rode the claim: a second claimer finds nothing.
      const second = await db.claimNextJob({
        owner: 'owner-b',
        claimToken: 'token-b',
        nowIso: new Date().toISOString(),
        leaseExpiresAtIso: new Date(Date.now() + 60_000).toISOString(),
        maxAttempts: TASK_MAX_ATTEMPTS,
      })
      assert.equal(second, undefined)
      // A stale worker whose lease was taken cannot settle over the fresh one.
      assert.equal(
        await db.settleJob({
          id: 'task_cas_1',
          claimToken: 'token-b',
          status: 'done',
          summary: 'stale write',
          nowIso: new Date().toISOString(),
        }),
        false,
      )
      assert.equal(
        await db.settleJob({
          id: 'task_cas_1',
          claimToken: 'token-a',
          status: 'done',
          summary: 'the real summary',
          nowIso: new Date().toISOString(),
        }),
        true,
      )
      const settled = await db.selectJob('task_cas_1')
      assert.equal(settled?.summary, 'the real summary')
    } finally {
      await db.close()
    }
  })

  it('caps concurrent runs at the budget and starts the next on a free slot', async () => {
    const db = openMemoryDb()
    try {
      const gates: Deferred[] = [deferred(), deferred(), deferred()]
      const started: string[] = []
      const queue = queueOver(db, async (job) => {
        started.push(job.id)
        await gates[started.length - 1]?.promise
        return { status: 'done', summary: 'done' }
      })
      const first = await queue.enqueue(BASE)
      const second = await queue.enqueue({ ...BASE, brief: 'Second job.' })
      const third = await queue.enqueue({ ...BASE, brief: 'Third job.' })
      // Wait until the first two are actually running before judging.
      await queue.waitFor(first.id, 0)
      for (let at = 0; at < 200 && started.length < 2; at += 1) await sleep(5)
      assert.equal(started.length, RUN_TASK_CAP)
      assert.deepEqual(await queue.counts(), { queued: 1, running: RUN_TASK_CAP })
      gates[0]?.release()
      assert.equal((await queue.waitFor(first.id, 2_000))?.status, 'done')
      for (let at = 0; at < 200 && !started.includes(third.id); at += 1) await sleep(5)
      // Third could only start once first freed a slot.
      assert.ok(started.includes(third.id))
      gates[1]?.release()
      gates[2]?.release()
      assert.equal((await queue.waitFor(second.id, 2_000))?.status, 'done')
      assert.equal((await queue.waitFor(third.id, 2_000))?.status, 'done')
    } finally {
      await db.close()
    }
  })

  it('gives a failed attempt a fresh attempt, then parks it failed with the generic note', async () => {
    const db = openMemoryDb()
    const alwaysDb = openMemoryDb() // its own table: deliverables stay per-scenario
    try {
      let attempts = 0
      const flaky = queueOver(db, async () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('router down')
        return { status: 'done', summary: 'Recovered on the second try.' }
      })
      const recovered = await flaky.waitFor((await flaky.enqueue(BASE)).id, 2_000)
      assert.equal(recovered?.status, 'done')
      assert.equal(recovered?.attempts, TASK_MAX_ATTEMPTS)
      assert.equal(recovered?.summary, 'Recovered on the second try.')

      const always = queueOver(alwaysDb, async (): Promise<TaskRunOutcome> => {
        throw new TypeError('router down')
      })
      const parked = await always.waitFor((await always.enqueue(BASE)).id, 2_000)
      assert.equal(parked?.status, 'failed')
      assert.equal(parked?.attempts, TASK_MAX_ATTEMPTS)
      // The person-facing text is the generic note; the throw stays server-side.
      assert.equal(parked?.summary, TASK_FAILED_NOTE)
      assert.doesNotMatch(JSON.stringify(parked ?? {}), /router down/)
      const due = await always.collectDeliverable('user_test', 'matter_1')
      assert.equal(due.length, 1)
      assert.equal(due[0]?.status, 'failed')
    } finally {
      await db.close()
      await alwaysDb.close()
    }
  })

  it('an empty summary from a done run counts as failed, without a fresh attempt', async () => {
    const db = openMemoryDb()
    try {
      let runs = 0
      const queue = queueOver(db, async (): Promise<TaskRunOutcome> => {
        runs += 1
        return { status: 'done', summary: '   ' }
      })
      const job = await queue.waitFor((await queue.enqueue(BASE)).id, 2_000)
      assert.equal(job?.status, 'failed')
      assert.equal(job?.summary, TASK_FAILED_NOTE)
      assert.equal(job?.attempts, 1)
      assert.equal(runs, 1)
    } finally {
      await db.close()
    }
  })

  it('collectDeliverable only reports the owner and the matter', async () => {
    const db = openMemoryDb()
    try {
      const queue = queueOver(db, async () => ({ status: 'done', summary: 'quiet' }))
      const own = await queue.enqueue(BASE)
      await queue.enqueue({ ...BASE, userId: 'user_b' })
      await queue.enqueue({ ...BASE, matterId: 'matter_2' })
      await queue.waitFor(own.id, 2_000)
      for (let at = 0; at < 100; at += 1) {
        if ((await queue.counts()).running === 0) break
        await sleep(5)
      }
      const due = await queue.collectDeliverable('user_test', 'matter_1')
      assert.deepEqual(due.map((job: TaskRunnerJob) => job.id), [own.id])
    } finally {
      await db.close()
    }
  })
})

describe('durable queue: the kill switch (CHATLEGAL_TASKRUNNER_MAX_CONCURRENT=0)', () => {
  it('claims nothing and runs nothing; raising the budget later drains the table', async () => {
    const db = openMemoryDb()
    try {
      let runs = 0
      const stopped = queueOver(
        db,
        async () => {
          runs += 1
          return { status: 'done', summary: 'never' }
        },
        { maxConcurrent: 0 },
      )
      const job = await stopped.enqueue(BASE)
      await sleep(30)
      assert.equal(runs, 0)
      assert.deepEqual(await stopped.counts(), { queued: 1, running: 0 })
      const timedOut = await stopped.waitFor(job.id, 20)
      assert.equal(timedOut?.status, 'queued')
      assert.equal(timedOut?.attempts, 0)

      // Same table, budget lifted (the restart case): the queue is all still
      // there and runs to done. Durability and the kill switch compose.
      const resumed = queueOver(db, async () => ({ status: 'done', summary: 'finally' }), { maxConcurrent: 1 })
      const settled = await resumed.waitFor(job.id, 2_000)
      assert.equal(settled?.status, 'done')
      assert.equal(settled?.summary, 'finally')
      assert.equal(settled?.attempts, 1)
      assert.equal(runs, 0)
    } finally {
      await db.close()
    }
  })
})

describe('durable queue: restart recovery', () => {
  it('a crash mid-run re-picks the job from its expired lease and finishes it', async () => {
    const file = openFileDb()
    try {
      const gate = deferred()
      const db1 = createTaskRunnerDb({ url: file.url })
      const crashed = queueOver(
        db1,
        async () => {
          await gate.promise
          return { status: 'done', summary: 'never, the process died' }
        },
        { leaseMs: 20 },
      )
      const job = await crashed.enqueue(BASE)
      // Let attempt 1 claim and go running; the gate keeps it there.
      for (let at = 0; at < 200; at += 1) {
        const current = await db1.selectJob(job.id)
        if (current?.status === 'running') break
        await sleep(5)
      }
      assert.equal((await db1.selectJob(job.id))?.status, 'running')
      // Crash: the process (and its client) die mid-run without settling.
      await db1.close()
      // Outlive the lease so the next process sees it as dead.
      await sleep(60)

      const db2 = createTaskRunnerDb({ url: file.url })
      try {
        const restarted = queueOver(db2, async () => ({ status: 'done', summary: 'Recovered after the restart.' }))
        const settled = await restarted.waitFor(job.id, 2_000)
        assert.equal(settled?.status, 'done')
        assert.equal(settled?.summary, 'Recovered after the restart.')
        // The reclaim consumed the second (final) attempt.
        assert.equal(settled?.attempts, TASK_MAX_ATTEMPTS)
        gate.release()
      } finally {
        await db2.close()
      }
    } finally {
      await file.close()
    }
  })

  it('a job that crashes on its final attempt parks failed with the generic note', async () => {
    const file = openFileDb()
    try {
      const first = deferred()
      const db1 = createTaskRunnerDb({ url: file.url })
      const crashed1 = queueOver(
        db1,
        async () => {
          await first.promise
          return { status: 'done', summary: 'never' }
        },
        { leaseMs: 20 },
      )
      const job = await crashed1.enqueue(BASE)
      for (let at = 0; at < 200; at += 1) {
        if ((await db1.selectJob(job.id))?.status === 'running') break
        await sleep(5)
      }
      await db1.close()
      await sleep(60)

      const second = deferred()
      const db2 = createTaskRunnerDb({ url: file.url })
      const crashed2 = queueOver(
        db2,
        async () => {
          await second.promise
          return { status: 'done', summary: 'never either' }
        },
        { leaseMs: 20 },
      )
      for (let at = 0; at < 200; at += 1) {
        const current = await db2.selectJob(job.id)
        if (current?.status === 'running' && current.attempts === TASK_MAX_ATTEMPTS) break
        await sleep(5)
      }
      await db2.close()
      await sleep(60)

      const db3 = createTaskRunnerDb({ url: file.url })
      try {
        // Attempt budget spent: the reconciler parks it, it never runs again.
        let ran = false
        const third = queueOver(db3, async () => {
          ran = true
          return { status: 'done', summary: 'must not run' }
        })
        const settled = await third.waitFor(job.id, 2_000)
        assert.equal(settled?.status, 'failed')
        assert.equal(settled?.summary, TASK_FAILED_NOTE)
        assert.equal(settled?.attempts, TASK_MAX_ATTEMPTS)
        assert.equal(ran, false)
        const due = await third.collectDeliverable(BASE.userId, BASE.matterId)
        assert.deepEqual(due.map((entry) => entry.id), [job.id])
        first.release()
        second.release()
      } finally {
        await db3.close()
      }
    } finally {
      await file.close()
    }
  })
})

describe('task runner db: the migration runner is minimal and idempotent', () => {
  it('applies each migration once, survives reopen, and is safe to run twice', async () => {
    const file = openFileDb()
    try {
      const client = createClient({ url: file.url })
      await ensureTaskRunnerSchema(client)
      await ensureTaskRunnerSchema(client) // twice: no throw, no duplicate rows
      const ledger = await client.execute(`SELECT id FROM ${TASK_RUNNER_SCHEMA_TABLE}`)
      assert.deepEqual(
        ledger.rows.map((row) => String(row.id)).sort(),
        TASK_RUNNER_MIGRATIONS.map((migration) => migration.id).sort(),
      )
      const table = await client.execute(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='task_runner_jobs'`,
      )
      assert.equal(table.rows.length, 1)
      client.close()
      // A second client on the same file finds the schema ready to use.
      const reopened = createTaskRunnerDb({ url: file.url })
      try {
        await reopened.ready
        assert.deepEqual(await reopened.counts({ nowIso: new Date().toISOString() }), { queued: 0, running: 0 })
      } finally {
        await reopened.close()
      }
    } finally {
      await file.close()
    }
  })
})
