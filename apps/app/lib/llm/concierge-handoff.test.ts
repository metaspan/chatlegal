/**
 * G-02: the Concierge owns the turn, the TaskRunner does the work.
 *
 * These pin the whole handoff path: the hand_off_to_task_runner offer, the
 * within-turn summary the Concierge narrates, the accepted/next-turn path
 * through tagged task-result context, the refused brief, and the promise
 * that an off gate leaves G-01 byte for byte (one tool, one prompt, and no
 * queue touch). The runner side is exercised for real through
 * taskRunnerQueueDeps in the last case: concierge and TaskRunner models on
 * one fake router, separated by the model id in the request body.
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'path'
import { appendMatterMessage, createMatter, createMatterStore, getMatterThread, type MatterStore } from '../matters/store.ts'
import type { MatterMessage } from '../matters/types.ts'
import { CONCIERGE_AGENT_PROMPT } from './concierge-prompt.ts'
import { streamConciergeTurn } from './concierge-agent.ts'
import { taskRunnerQueueDeps } from './task-runner.ts'
import type { TaskRunnerQueue, TaskRunOutcome } from '../task-runner/queue.ts'
import { createDurableTaskRunnerQueue } from '../task-runner/durable-queue.ts'
import { createTaskRunnerDb } from '../task-runner/db.ts'

const LITELLM_ENV = {
  CHATLEGAL_LITELLM_BASE_URL: 'http://127.0.0.1:9/v1',
  CHATLEGAL_LITELLM_API_KEY: '«redacted:sk-…»',
}

type Call = { url: string; init: RequestInit }

function sse(lines: string[]): Response {
  return new Response(lines.join('\n'), { status: 200, headers: { 'content-type': 'text/event-stream' } })
}

function deltaChunk(text: string): string {
  return `data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}`
}

function toolCallChunks(id: string, name: string, argsJson: string): string[] {
  const pieces = [
    `data: ${JSON.stringify({
      choices: [{ delta: { tool_calls: [{ index: 0, id, function: { name, arguments: '' } }] } }] as unknown[],
    })}`,
  ]
  for (let at = 0; at < argsJson.length; at += 24) {
    pieces.push(
      `data: ${JSON.stringify({
        choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: argsJson.slice(at, at + 24) } }] } }] as unknown[],
      })}`,
    )
  }
  return pieces
}

const DONE = 'data: [DONE]'

const HANDOFF_ARGS = { title: 'Deposit dates', brief: 'Check the dates the tenant gave for the deposit protection.' }

async function openStore(): Promise<{ store: MatterStore; close: () => Promise<void> }> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-taskrunner-'))
  const store = await createMatterStore(`file:${path.join(dir, 'matters.db')}`, { env: {} })
  return {
    store,
    close: async () => {
      await store.close()
      fs.rmSync(dir, { recursive: true, force: true })
    },
  }
}

async function newMatter(store: MatterStore, text: string): Promise<string> {
  const matter = await createMatter(store, 'user_test', { title: 'Deposit' })
  await appendMatterMessage(store, 'user_test', matter.id, { role: 'user', text })
  return matter.id
}

async function collectTurn(input: {
  store: MatterStore
  matterId: string
  userText?: string
  env?: NodeJS.ProcessEnv
  fetchImpl: typeof fetch
  taskRunner?: { queue: TaskRunnerQueue }
}): Promise<Record<string, unknown>[]> {
  const events: Record<string, unknown>[] = []
  for await (const event of streamConciergeTurn({
    store: input.store,
    userId: 'user_test',
    matterId: input.matterId,
    userText: input.userText,
    env: input.env ?? LITELLM_ENV,
    fetchImpl: input.fetchImpl,
    ...(input.taskRunner ? { taskRunner: input.taskRunner } : {}),
  })) {
    events.push(event as unknown as Record<string, unknown>)
  }
  return events
}

function scriptedFetch(responses: (() => Response)[]): { fetchImpl: typeof fetch; calls: Call[] } {
  const calls: Call[] = []
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} }
    calls.push(call)
    const next = responses[calls.length - 1]
    if (!next) throw new Error(`unexpected model call ${calls.length}`)
    return next()
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

function bodyOf(call: Call): {
  model: string
  tools?: { function: { name: string } }[]
  messages: { role: string; content?: string; tool_calls?: { function: { name: string } }[] }[]
} {
  return JSON.parse(String(call.init.body)) as never
}

/**
 * G-03: the queue under test is the durable one — same contract, real
 * LibSQL behind it (:memory: per test), so the handoff path is exercised
 * against the shape the routes actually hand over.
 */
async function openQueue(
  outcome: () => Promise<TaskRunOutcome>,
): Promise<{ queue: TaskRunnerQueue; close: () => Promise<void> }> {
  const db = createTaskRunnerDb({ url: ':memory:' })
  const queue = createDurableTaskRunnerQueue({ runJob: async () => outcome() }, { db, pollMs: 5, leaseMs: 60_000 })
  return { queue, close: () => db.close() }
}

describe('Concierge → TaskRunner handoff (G-02)', () => {
  it('a quick job is narrated in the same turn and nothing internal is stored', async () => {
    const { store, close } = await openStore()
    let closeQueue: (() => Promise<void>) | undefined
    try {
      const matterId = await newMatter(store, 'My landlord never protected my deposit.')
      const { fetchImpl, calls } = scriptedFetch([
        () =>
          sse([
            deltaChunk('Give me a moment on the dates. '),
            ...toolCallChunks('hand-1', 'hand_off_to_task_runner', JSON.stringify(HANDOFF_ARGS)),
            DONE,
          ]),
        () => sse([deltaChunk('The ten-day protection rule applies here.'), DONE]),
      ])
      const opened = await openQueue(async () => ({ status: 'done', summary: 'The ten-day rule starts at payment.' }))
      closeQueue = opened.close
      const queue = opened.queue
      const events = await collectTurn({ store, matterId, userText: 'My landlord never protected my deposit.', fetchImpl, taskRunner: { queue } })

      // The handoff itself is silent: half-shown copy is reset, the pane
      // only ever sees the Concierge's final, stored words.
      assert.deepEqual(
        events.map((event) => event.type),
        ['delta', 'reset', 'delta', 'assistant'],
      )
      assert.equal((events[3].message as MatterMessage).text, 'The ten-day protection rule applies here.')

      // Offered the handoff next to askChoice, on the G-02 prompt.
      const first = bodyOf(calls[0])
      assert.equal(first.model, 'chatlegal-concierge')
      assert.deepEqual(first.tools?.map((tool) => tool.function.name), ['askChoice', 'hand_off_to_task_runner'])
      assert.match(first.messages[0].content ?? '', /Background work:/)
      assert.match(first.messages[0].content ?? '', /hand_off_to_task_runner/)

      // The retry carries the call and the finished summary as its tool result.
      const second = bodyOf(calls[1])
      const assistant = second.messages.at(-2)
      const tool = second.messages.at(-1)
      assert.equal(assistant?.role, 'assistant')
      assert.equal(assistant?.tool_calls?.[0].function.name, 'hand_off_to_task_runner')
      assert.equal(tool?.role, 'tool')
      assert.match(tool?.content ?? '', /"status":"done"/)
      assert.match(tool?.content ?? '', /ten-day rule starts at payment/)

      // Thread: user, then one assistant line. No task ids, tools, or JSON.
      const thread = await getMatterThread(store, 'user_test', matterId)
      assert.deepEqual(thread?.messages.map((message) => message.text), [
        'My landlord never protected my deposit.',
        'The ten-day protection rule applies here.',
      ])
      const shown = JSON.stringify(thread?.messages)
      assert.doesNotMatch(shown, /tool_calls|hand_off|"arguments"|task_/)
    } finally {
      await closeQueue?.()
      await close()
    }
  })

  it('a slow job is accepted, then narrated next turn as tagged task-result context, once', async () => {
    const { store, close } = await openStore()
    let closeQueue: (() => Promise<void>) | undefined
    try {
      const matterId = await newMatter(store, 'Which deadlines apply to my deposit?')
      let release: (outcome: TaskRunOutcome) => void = () => {}
      const pending = new Promise<TaskRunOutcome>((resolve) => {
        release = resolve
      })
      const opened = await openQueue(() => pending)
      closeQueue = opened.close
      const queue = opened.queue

      const firstTurn = scriptedFetch([
        () => sse([...toolCallChunks('hand-1', 'hand_off_to_task_runner', JSON.stringify(HANDOFF_ARGS)), DONE]),
        () => sse([deltaChunk('I am looking into the dates now and will report back.'), DONE]),
      ])
      const events = await collectTurn({
        store,
        matterId,
        env: { ...LITELLM_ENV, CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS: '0' },
        fetchImpl: firstTurn.fetchImpl,
        taskRunner: { queue },
      })
      assert.deepEqual(
        events.map((event) => event.type),
        ['delta', 'assistant'],
      )
      const accepted = bodyOf(firstTurn.calls[1]).messages.at(-1)
      assert.match(accepted?.content ?? '', /"status":"accepted"/)
      assert.match(accepted?.content ?? '', /will report the outcome/)

      // The job finishes between turns. The G-03 queue is async: wait for
      // its settle through the queue itself, not a microtask spin.
      release({ status: 'done', summary: 'Two dates clash: the notice is 6 April, the deposit is 3 April.' })
      const acceptedBody = JSON.parse(bodyOf(firstTurn.calls[1]).messages.at(-1)?.content ?? '{}') as {
        task_id?: string
      }
      assert.ok(acceptedBody.task_id, 'the accepted result carries the task id')
      assert.equal((await queue.waitFor(acceptedBody.task_id, 2_000))?.status, 'done')

      const secondTurn = scriptedFetch([() => sse([deltaChunk('The two dates clash: mind the 3 April one.'), DONE])])
      const later = await collectTurn({ store, matterId, userText: 'Anything else?', fetchImpl: secondTurn.fetchImpl, taskRunner: { queue } })
      assert.deepEqual(
        later.map((event) => event.type),
        ['delta', 'assistant'],
      )
      // The result rides the system message as a tagged block, concierge-
      // signal style: context, never a fake user message.
      const system = bodyOf(secondTurn.calls[0]).messages[0].content ?? ''
      assert.match(system, /<task-results>/)
      assert.match(system, /<task-result id="task_[^"]*" title="Deposit dates" status="done">/)
      assert.match(system, /6 April/)
      assert.match(bodyOf(secondTurn.calls[0]).messages.at(-1)?.content ?? '', /Anything else\?/)

      // Reported once: a third turn sees no block.
      const thirdTurn = scriptedFetch([() => sse([deltaChunk('Anything else I can help with?'), DONE])])
      await collectTurn({ store, matterId, userText: 'Thanks', fetchImpl: thirdTurn.fetchImpl, taskRunner: { queue } })
      assert.doesNotMatch(bodyOf(thirdTurn.calls[0]).messages[0].content ?? '', /<task-results>/)
    } finally {
      await closeQueue?.()
      await close()
    }
  })

  it('a refused brief queues nothing and lets the Concierge answer in words', async () => {
    const { store, close } = await openStore()
    let closeQueue: (() => Promise<void>) | undefined
    try {
      const matterId = await newMatter(store, 'Help with my deposit.')
      const { fetchImpl, calls } = scriptedFetch([
        () =>
          sse([
            deltaChunk('Let me check that. '),
            ...toolCallChunks('hand-bad', 'hand_off_to_task_runner', JSON.stringify({ brief: '   ' })),
            DONE,
          ]),
        () => sse([deltaChunk('Start with your deposit receipt and the date you paid.'), DONE]),
      ])
      const opened = await openQueue(async () => ({ status: 'done', summary: 'never runs' }))
      closeQueue = opened.close
      const queue = opened.queue
      const events = await collectTurn({ store, matterId, userText: 'Help with my deposit.', fetchImpl, taskRunner: { queue } })
      assert.deepEqual(
        events.map((event) => event.type),
        ['delta', 'reset', 'delta', 'assistant'],
      )
      const retry = bodyOf(calls[1])
      const refused = retry.messages.at(-2)
      const result = retry.messages.at(-1)
      assert.equal(refused?.role, 'assistant')
      assert.ok(refused?.tool_calls)
      assert.equal(result?.role, 'tool')
      assert.match(result?.content ?? '', /invalid_props/)
      assert.match(result?.content ?? '', /brief/)
      const thread = await getMatterThread(store, 'user_test', matterId)
      assert.deepEqual(thread?.messages.map((message) => message.text), [
        'Help with my deposit.',
        'Start with your deposit receipt and the date you paid.',
      ])
    } finally {
      await closeQueue?.()
      await close()
    }
  })

  it('no queue on the turn means the exact G-01 request: one tool, G-01 prompt', async () => {
    const { store, close } = await openStore()
    try {
      const matterId = await newMatter(store, 'Rent was raised.')
      const { fetchImpl, calls } = scriptedFetch([() => sse([deltaChunk('Check your tenancy agreement.'), DONE])])
      await collectTurn({ store, matterId, userText: 'Rent was raised.', fetchImpl })
      const body = bodyOf(calls[0])
      assert.deepEqual(body.tools?.map((tool) => tool.function.name), ['askChoice'])
      assert.equal(body.messages[0].content, CONCIERGE_AGENT_PROMPT)
    } finally {
      await close()
    }
  })

  it('off is G-01 unchanged: no model call, no TaskRunner call, no events', async () => {
    const { store, close } = await openStore()
    let closeQueue: (() => Promise<void>) | undefined
    try {
      const matterId = await newMatter(store, 'Hello.')
      let called = 0
      const fetchImpl = (async () => {
        called += 1
        return sse([deltaChunk('never'), DONE])
      }) as unknown as typeof fetch
      const opened = await openQueue(async () => {
        throw new Error('the queue must never run with the gate off')
      })
      closeQueue = opened.close
      const queue = opened.queue
      const events = await collectTurn({
        store,
        matterId,
        env: {},
        fetchImpl,
        taskRunner: { queue },
      })
      assert.deepEqual(events, [])
      assert.equal(called, 0)
      assert.deepEqual(await queue.counts(), { queued: 0, running: 0 })
    } finally {
      await closeQueue?.()
      await close()
    }
  })

  it('end to end: both models on one router, stub tool executed host-side', async () => {
    const { store, close } = await openStore()
    const db = createTaskRunnerDb({ url: ':memory:' })
    try {
      const matterId = await newMatter(store, 'Here is my story: I paid 900 pounds on the 1st.')
      const seen: { concierge: number; taskrunner: number } = { concierge: 0, taskrunner: 0 }
      const fetchImpl = (async (url: unknown, init?: RequestInit) => {
        const body = JSON.parse(String((init ?? {}).body)) as { model: string }
        if (body.model === 'chatlegal-taskrunner') {
          seen.taskrunner += 1
          if (seen.taskrunner === 1) {
            return sse([
              ...toolCallChunks('run-1', 'count_words', JSON.stringify({ text: 'I paid 900 pounds on the 1st.' })),
              DONE,
            ])
          }
          return sse([deltaChunk('The note gives one payment: 900 pounds on the 1st of the month.'), DONE])
        }
        seen.concierge += 1
        if (seen.concierge === 1) {
          return sse([...toolCallChunks('hand-1', 'hand_off_to_task_runner', JSON.stringify(HANDOFF_ARGS)), DONE])
        }
        return sse([deltaChunk('Your note gives one payment: 900 pounds on the 1st. Keep that receipt safe.'), DONE])
      }) as unknown as typeof fetch
      const queue = createDurableTaskRunnerQueue(taskRunnerQueueDeps(LITELLM_ENV, fetchImpl), {
        db,
        maxConcurrent: 2,
        pollMs: 5,
        leaseMs: 60_000,
      })
      const events = await collectTurn({ store, matterId, userText: 'Here is my story: I paid 900 pounds on the 1st.', fetchImpl, taskRunner: { queue } })
      assert.deepEqual(
        events.map((event) => event.type),
        ['delta', 'assistant'],
      )
      assert.equal((events[1].message as MatterMessage).text, 'Your note gives one payment: 900 pounds on the 1st. Keep that receipt safe.')
      assert.deepEqual(seen, { concierge: 2, taskrunner: 2 })
      const thread = await getMatterThread(store, 'user_test', matterId)
      assert.deepEqual(thread?.messages.map((message) => message.role), ['user', 'assistant'])
      assert.doesNotMatch(JSON.stringify(thread?.messages), /count_words|task_|"arguments"/)
    } finally {
      await db.close()
      await close()
    }
  })
})
