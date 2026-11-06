import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createTaskRunnerQueue,
  RUN_TASK_CAP,
  TASK_MAX_ATTEMPTS,
  TASK_FAILED_NOTE,
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

async function settle(): Promise<void> {
  // Let the queue's microtask chain (runJob -> finish -> pump) catch up.
  for (let tick = 0; tick < 10; tick += 1) await Promise.resolve()
}

describe('createTaskRunnerQueue (G-02)', () => {
  it('runs a job to done and hands its summary out exactly once', async () => {
    const runs: { id: string; title: string; brief: string; attempt: number }[] = []
    const queue = createTaskRunnerQueue({
      runJob: async (job) => {
        runs.push(job)
        return { status: 'done', summary: 'Two dates collide: 6 April and 3 April.' }
      },
    })
    const job = queue.enqueue(BASE)
    // The queue pumps on enqueue: the job is claimed or already running.
    assert.ok(job.status === 'queued' || job.status === 'running')
    const settled = await queue.waitFor(job.id, 2_000)
    assert.equal(settled?.status, 'done')
    assert.equal(settled?.summary, 'Two dates collide: 6 April and 3 April.')
    assert.equal(settled?.attempts, 1)
    assert.equal(runs.length, 1)
    assert.equal(runs[0].attempt, 1)
    assert.equal(runs[0].brief, BASE.brief)
    // Reported once, then silent — nobody narrates the same outcome twice.
    const due = queue.collectDeliverable('user_test', 'matter_1')
    assert.deepEqual(due.map((entry) => entry.id), [job.id])
    assert.deepEqual(queue.collectDeliverable('user_test', 'matter_1'), [])
    assert.deepEqual(queue.counts(), { queued: 0, running: 0 })
  })

  it('caps concurrent runs at the budget and starts the next on a free slot', async () => {
    const gates: Deferred[] = [deferred(), deferred(), deferred()]
    const started: string[] = []
    const queue = createTaskRunnerQueue({
      runJob: async (job) => {
        started.push(job.id)
        // Pre-made gates, taken in start order: the first RUN_TASK_CAP jobs
        // block here, the rest never reach a gate until a slot frees.
        await gates[started.length - 1].promise
        return { status: 'done', summary: 'done' }
      },
    })
    const first = queue.enqueue(BASE)
    const second = queue.enqueue({ ...BASE, brief: 'Second job.' })
    const third = queue.enqueue({ ...BASE, brief: 'Third job.' })
    await settle()
    assert.equal(started.length, RUN_TASK_CAP)
    assert.deepEqual(queue.counts(), { queued: 1, running: RUN_TASK_CAP })
    gates[0].release()
    assert.equal((await queue.waitFor(first.id, 2_000))?.status, 'done')
    // Third could only start once first freed a slot.
    assert.ok(started.includes(third.id))
    gates[1].release()
    gates[2].release()
    assert.equal((await queue.waitFor(second.id, 2_000))?.status, 'done')
    assert.equal((await queue.waitFor(third.id, 2_000))?.status, 'done')
  })

  it('gives a failed attempt a fresh attempt, then parks it failed with the generic note', async () => {
    let attempts = 0
    const flaky = createTaskRunnerQueue({
      runJob: async () => {
        attempts += 1
        if (attempts === 1) throw new TypeError('router down')
        return { status: 'done', summary: 'Recovered on the second try.' }
      },
    })
    const recovered = await flaky.waitFor(flaky.enqueue(BASE).id, 2_000)
    assert.equal(recovered?.status, 'done')
    assert.equal(recovered?.attempts, TASK_MAX_ATTEMPTS)
    assert.equal(recovered?.summary, 'Recovered on the second try.')

    const always = createTaskRunnerQueue({
      runJob: async () => {
        throw new TypeError('router down')
      },
    })
    const parked = await always.waitFor(always.enqueue(BASE).id, 2_000)
    assert.equal(parked?.status, 'failed')
    assert.equal(parked?.attempts, TASK_MAX_ATTEMPTS)
    // The person-facing text is the generic note; the throw stays server-side.
    assert.equal(parked?.summary, TASK_FAILED_NOTE)
    assert.doesNotMatch(JSON.stringify(parked ?? {}), /router down/)
    const due = always.collectDeliverable('user_test', 'matter_1')
    assert.equal(due.length, 1)
    assert.equal(due[0].status, 'failed')
  })

  it('an empty summary from a done run counts as failed', async () => {
    const queue = createTaskRunnerQueue({
      runJob: async (): Promise<TaskRunOutcome> => ({ status: 'done', summary: '   ' }),
    })
    const job = await queue.waitFor(queue.enqueue(BASE).id, 2_000)
    assert.equal(job?.status, 'failed')
    assert.equal(job?.summary, TASK_FAILED_NOTE)
  })

  it('the kill switch queues without ever running (documented S3 edge)', async () => {
    let runs = 0
    const queue = createTaskRunnerQueue(
      {
        runJob: async () => {
          runs += 1
          return { status: 'done', summary: 'never' }
        },
      },
      { maxConcurrent: 0 },
    )
    const job = queue.enqueue(BASE)
    await settle()
    assert.equal(runs, 0)
    assert.deepEqual(queue.counts(), { queued: 1, running: 0 })
    const timedOut = await queue.waitFor(job.id, 20)
    assert.equal(timedOut?.status, 'queued')
  })

  it('waitFor times out on a live job without settling it', async () => {
    const gate = deferred()
    const queue = createTaskRunnerQueue({
      runJob: async (job) => {
        if (job.attempt === 1) await gate.promise
        return { status: 'done', summary: 'late' }
      },
    })
    const job = queue.enqueue(BASE)
    const early = await queue.waitFor(job.id, 15)
    assert.equal(early?.status, 'running')
    gate.release()
    const settled = await queue.waitFor(job.id, 2_000)
    assert.equal(settled?.status, 'done')
  })

  it('collectDeliverable only reports the owner and the matter', async () => {
    const queue = createTaskRunnerQueue({
      runJob: async () => ({ status: 'done', summary: 'quiet' }),
    })
    const own = queue.enqueue(BASE)
    queue.enqueue({ ...BASE, userId: 'user_b' })
    queue.enqueue({ ...BASE, matterId: 'matter_2' })
    await queue.waitFor(own.id, 2_000)
    await settle()
    const due = queue.collectDeliverable('user_test', 'matter_1')
    assert.deepEqual(due.map((job: TaskRunnerJob) => job.id), [own.id])
  })
})
