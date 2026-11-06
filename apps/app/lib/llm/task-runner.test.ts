import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { litellmConfig } from './config.ts'
import { runTaskRunnerTool } from './task-runner-tools.ts'
import {
  handoffWaitMs,
  isTaskRunnerEnabled,
  resolveTaskRunnerMaxConcurrent,
  runTaskRunnerJob,
  taskRunnerBriefMessage,
  taskRunnerQueueDeps,
  TASK_RUNNER_MAX_STEPS,
  TASK_SUMMARY_MAX_CHARS,
} from './task-runner.ts'
import { TASK_FAILED_NOTE } from '../task-runner/queue.ts'

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

function config() {
  const parsed = litellmConfig(LITELLM_ENV)
  assert.notEqual(parsed, false)
  return parsed as Exclude<typeof parsed, false>
}

async function runWith(responses: (call: Call, index: number) => Response[], extra: Record<string, unknown> = {}) {
  const calls: Call[] = []
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} }
    calls.push(call)
    return responses[calls.length - 1](call, calls.length - 1)
  }) as unknown as typeof fetch
  const outcome = await runTaskRunnerJob({
    config: config(),
    model: config().taskRunnerModel,
    title: 'Deposit dates',
    brief: 'Check the dates the tenant gave.',
    env: LITELLM_ENV,
    fetchImpl,
    sleep: async () => {},
    ...extra,
  })
  return { outcome, calls }
}

function bodyOf(call: Call): Record<string, unknown> {
  return JSON.parse(String(call.init.body)) as Record<string, unknown>
}

describe('runTaskRunnerJob (G-02)', () => {
  it('answers a plain job with the model summary on the TaskRunner alias', async () => {
    const { outcome, calls } = await runWith([
      () => sse([deltaChunk('The ten-day '), deltaChunk('rule applies here.'), DONE]),
    ])
    assert.deepEqual(outcome, { status: 'done', summary: 'The ten-day rule applies here.' })
    assert.equal(calls.length, 1)
    const body = bodyOf(calls[0])
    assert.equal(body.model, 'chatlegal-taskrunner')
    const toolNames = (body.tools as { function: { name: string } }[]).map((tool) => tool.function.name)
    assert.deepEqual(toolNames, ['echo', 'timed_noop', 'count_words'])
    const messages = body.messages as { role: string; content: string }[]
    assert.equal(messages[0].role, 'system')
    assert.match(messages[0].content, /background assistant/i)
    assert.doesNotMatch(messages[0].content, /You are the ChatLegal concierge/)
    assert.equal(messages[1].role, 'user')
    assert.match(messages[1].content, /Job: Deposit dates/)
  })

  it('executes a stub tool host-side and the transcript never leaves the loop', async () => {
    const { outcome, calls } = await runWith([
      () => sse([...toolCallChunks('run-1', 'count_words', JSON.stringify({ text: 'one two three' })), DONE]),
      () => sse([deltaChunk('I counted three words in the note.'), DONE]),
    ])
    assert.equal(outcome.status, 'done')
    assert.equal(outcome.summary, 'I counted three words in the note.')
    assert.equal(calls.length, 2)
    const messages = bodyOf(calls[1]).messages as { role: string; content?: string; tool_calls?: unknown[] }[]
    const assistant = messages.at(-2)
    const tool = messages.at(-1)
    assert.equal(assistant?.role, 'assistant')
    assert.ok(assistant?.tool_calls)
    assert.equal(tool?.role, 'tool')
    assert.match(tool?.content ?? '', /"words":3/)
  })

  it('nudges once when the first completion is empty, like the MIN_VISIBLE_TOKENS floor', async () => {
    const { outcome, calls } = await runWith([
      () => sse([DONE]),
      () => sse([deltaChunk('Here is the plain summary.'), DONE]),
    ])
    assert.equal(outcome.status, 'done')
    assert.equal(calls.length, 2)
    const messages = bodyOf(calls[1]).messages as { role: string; content: string }[]
    assert.equal(messages.at(-1)?.role, 'user')
    assert.match(messages.at(-1)?.content, /summary/i)
  })

  it('gives up after the step budget with the generic note, never a partial transcript', async () => {
    const { outcome, calls } = await runWith(
      Array.from({ length: TASK_RUNNER_MAX_STEPS + 2 }, (_unused, index) => () =>
        sse([...toolCallChunks(`run-${index}`, 'echo', JSON.stringify({ message: 'again' })), DONE]),
      ),
    )
    assert.equal(outcome.status, 'failed')
    assert.equal(outcome.summary, TASK_FAILED_NOTE)
    assert.equal(calls.length, TASK_RUNNER_MAX_STEPS)
  })

  it('cuts a job that outlives the wall clock', async () => {
    // The clock jumps past the 60s job timeout after the first step.
    let tick = 0
    const { outcome, calls } = await runWith(
      Array.from({ length: TASK_RUNNER_MAX_STEPS }, (_unused, index) => () =>
        sse([...toolCallChunks(`run-${index}`, 'echo', JSON.stringify({ message: 'slow' })), DONE]),
      ),
      {
        now: () => {
          tick += 1
          // startedAt and the first step check see t=0; the second step
          // check sees the clock jump past the 60s job timeout.
          return tick <= 2 ? 0 : 90_000
        },
      },
    )
    assert.equal(calls.length, 1)
    assert.equal(outcome.status, 'failed')
  })

  it('clamps a runaway summary to the cap', async () => {
    const long = 'x'.repeat(TASK_SUMMARY_MAX_CHARS + 500)
    const { outcome } = await runWith([() => sse([deltaChunk(long), DONE])])
    assert.equal(outcome.status, 'done')
    assert.ok(outcome.summary.length <= TASK_SUMMARY_MAX_CHARS)
    assert.ok(outcome.summary.endsWith('…'))
  })
})

describe('runTaskRunnerTool (G-02 stubs)', () => {
  const sleepLog: number[] = []
  const deps = {
    sleep: async (ms: number) => {
      sleepLog.push(ms)
    },
  }

  it('echo, timed_noop (capped, via the injected sleep), and count_words', async () => {
    assert.deepEqual(JSON.parse(await runTaskRunnerTool('echo', '{"message":"  hello  "}', deps)), {
      tool: 'echo',
      echoed: 'hello',
    })
    assert.deepEqual(JSON.parse(await runTaskRunnerTool('timed_noop', '{"ms":99999}', deps)), {
      tool: 'timed_noop',
      waited_ms: 2_000,
    })
    assert.deepEqual(sleepLog, [2_000])
    assert.deepEqual(JSON.parse(await runTaskRunnerTool('count_words', '{"text":" a  b\\n c "}', deps)), {
      tool: 'count_words',
      words: 3,
      characters: 9,
    })
  })

  it('bad calls answer with a readable error, never a throw', async () => {
    assert.match(await runTaskRunnerTool('rm_rf', '{}', deps), /unknown_tool/)
    assert.match(await runTaskRunnerTool('echo', 'not json', deps), /not_json/)
    assert.match(await runTaskRunnerTool('echo', '[1]', deps), /not_an_object/)
    assert.match(await runTaskRunnerTool('echo', '{"message":"  "}', deps), /message_required/)
    assert.match(await runTaskRunnerTool('count_words', '{"text":"   "}', deps), /text_required/)
  })
})

describe('the G-02 gate and knobs', () => {
  it('off means the TaskRunner does not exist', () => {
    assert.equal(isTaskRunnerEnabled({}), false)
    assert.equal(isTaskRunnerEnabled({ CHATLEGAL_LITELLM_BASE_URL: 'http://127.0.0.1:9/v1' }), false)
    assert.equal(isTaskRunnerEnabled(LITELLM_ENV), true)
    assert.equal(isTaskRunnerEnabled({ ...LITELLM_ENV, CHATLEGAL_TASKRUNNER_MODEL: 'custom-runner' }), true)
  })

  it('max-concurrent parses like the TaskRunner pack (0 is the kill switch)', () => {
    assert.equal(resolveTaskRunnerMaxConcurrent(undefined), 2)
    assert.equal(resolveTaskRunnerMaxConcurrent('  '), 2)
    assert.equal(resolveTaskRunnerMaxConcurrent('nonsense'), 2)
    assert.equal(resolveTaskRunnerMaxConcurrent('-1'), 2)
    assert.equal(resolveTaskRunnerMaxConcurrent('0'), 0)
    assert.equal(resolveTaskRunnerMaxConcurrent('3'), 3)
    assert.equal(resolveTaskRunnerMaxConcurrent('1.9'), 1)
  })

  it('the handoff wait defaults to 8s, is tunable, and is bounded', () => {
    assert.equal(handoffWaitMs({}), 8_000)
    assert.equal(handoffWaitMs({ CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS: '0' }), 0)
    assert.equal(handoffWaitMs({ CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS: '1500' }), 1_500)
    assert.equal(handoffWaitMs({ CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS: '999999' }), 30_000)
    assert.equal(handoffWaitMs({ CHATLEGAL_TASKRUNNER_HANDOFF_WAIT_MS: 'nonsense' }), 8_000)
  })

  it('the queue dep never rethrows and fails quietly when the gate is off', async () => {
    const off = taskRunnerQueueDeps({})
    assert.deepEqual(await off.runJob({ id: 't1', title: 'x', brief: 'y', attempt: 1 }), {
      status: 'failed',
      summary: TASK_FAILED_NOTE,
    })
    const broken = taskRunnerQueueDeps(LITELLM_ENV, (async () => {
      throw new TypeError('fetch failed')
    }) as unknown as typeof fetch)
    const failed = await broken.runJob({ id: 't2', title: 'x', brief: 'y', attempt: 1 })
    assert.equal(failed.status, 'failed')
    assert.doesNotMatch(failed.summary, /fetch failed/)
  })

  it('the brief message carries the title when there is one', () => {
    assert.equal(taskRunnerBriefMessage(' Dates ', '  check them ').content, 'Job: Dates\n\ncheck them')
    assert.equal(taskRunnerBriefMessage('', 'check them').content, 'check them')
  })
})
