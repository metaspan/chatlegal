import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { withProcessEnvLock } from '../process-env-lock.ts'
import { parseAskChoiceProps } from './ask-choice.ts'
import {
  FIRST_TURN_PAPERS_QUESTION,
  FIRST_TURN_URLS,
  FIRST_TURN_WHERE_QUESTION,
  firstTurnOpeningText,
  matterOpenedFromCreate,
} from './first-turn.ts'
import { appendFirstTurnContinuation, seedMatterFirstTurn } from './seed-first-turn.ts'
import {
  answerAskChoice,
  appendAskChoice,
  createMatter,
  createMatterStore,
  disconnectMatterStore,
  getMatterStore,
  getMatterThread,
  type MatterStore,
} from './store.ts'

async function withStore(run: (store: MatterStore) => Promise<void>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-first-turn-'))
  const url = `file:${path.join(dir, 'matters.db')}`
  let store: MatterStore | null = null
  try {
    store = await createMatterStore(url, { env: {} })
    await run(store)
  } finally {
    await store?.close()
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

describe('seed first turn', () => {
  it('stores the notice, then the place card, then the papers card', async () => {
    await withStore(async (store) => {
      const matter = await createMatter(store, 'user_a')
      assert.deepEqual((await getMatterThread(store, 'user_a', matter.id))?.messages, [])
      assert.equal(await seedMatterFirstTurn(store, 'user_b', matter.id), null)

      const messages = await seedMatterFirstTurn(store, 'user_a', matter.id)
      assert.ok(messages)
      assert.equal(messages[0]?.text, firstTurnOpeningText())
      assert.equal(messages[0]?.role, 'assistant')
      assert.equal(messages[1]?.widget?.question, FIRST_TURN_WHERE_QUESTION)
      assert.equal(messages[1]?.widget?.status, 'pending')
      assert.equal(messages[2]?.widget?.question, FIRST_TURN_PAPERS_QUESTION)
      assert.equal(messages[2]?.widget?.multiSelect, true)
      assert.ok(messages[0] && messages[1] && messages[0].createdAt < messages[1].createdAt)
      assert.ok(messages[1] && messages[2] && messages[1].createdAt < messages[2].createdAt)
      assert.equal(await getMatterThread(store, 'user_b', matter.id), null)
    })
  })

  it('adds one templated note for a first-turn pick and leaves other cards alone', async () => {
    await withStore(async (store) => {
      const matter = await createMatter(store, 'user_a', { title: 'Deposit' })
      const messages = await seedMatterFirstTurn(store, 'user_a', matter.id)
      assert.ok(messages)
      const whereId = messages[1]?.widget?.toolCallId ?? ''
      const papersId = messages[2]?.widget?.toolCallId ?? ''
      const where = await answerAskChoice(store, 'user_a', matter.id, whereId, { choice: 'scotland' })
      assert.equal(where.ok, true)
      if (!where.ok) return
      const note = await appendFirstTurnContinuation(store, 'user_a', matter.id, where.message)
      assert.match(note?.text ?? '', /https:\/\/www\.mygov\.scot\//)
      // C-13: templated notes no longer lead with the AI-generated label; the footer owns it.
      assert.doesNotMatch(note?.text ?? '', /AI-generated information/)
      assert.match(note?.text ?? '', /This is not legal advice/)
      const again = await appendFirstTurnContinuation(store, 'user_a', matter.id, where.message)
      assert.equal(again?.id, note?.id)
      const afterWhere = await getMatterThread(store, 'user_a', matter.id)
      assert.equal(afterWhere?.messages.filter((message) => message.text === note?.text).length, 1)

      const papers = await answerAskChoice(store, 'user_a', matter.id, papersId, { choices: ['court-papers', 'letter'] })
      assert.equal(papers.ok, true)
      if (!papers.ok) return
      const deadline = await appendFirstTurnContinuation(store, 'user_a', matter.id, papers.message)
      assert.match(deadline?.text ?? '', new RegExp(FIRST_TURN_URLS.possession.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
      assert.match(deadline?.text ?? '', /not legal advice/)
      assert.doesNotMatch(deadline?.text ?? '', /you will win|we advise|Citizens Advice/i)

      const other = await appendAskChoice(
        store,
        'user_a',
        matter.id,
        parseAskChoiceProps({
          question: 'Which route fits this notice?',
          options: [
            { id: 'scheme', label: 'Deposit scheme' },
            { id: 'court', label: 'Court' },
          ],
        }),
      )
      const otherId = other?.widget?.toolCallId ?? ''
      const picked = await answerAskChoice(store, 'user_a', matter.id, otherId, { choice: 'scheme' })
      assert.equal(picked.ok, true)
      if (!picked.ok) return
      assert.equal(await appendFirstTurnContinuation(store, 'user_a', matter.id, picked.message), null)
    })
  })
})

describe('create matter route', () => {
  it('returns the first turn for the signed-in user and a note after the place card', async () => {
    await withProcessEnvLock(async () => {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatlegal-create-route-'))
      const previousDb = process.env.CHATLEGAL_MATTERS_DB
      const previousSession = process.env.CHATLEGAL_TEST_SESSION
      process.env.CHATLEGAL_MATTERS_DB = `file:${path.join(dir, 'matters.db')}`
      process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
      delete process.env.CHATLEGAL_OM_ENABLED
      delete process.env.CHATLEGAL_OM_MODEL
      await disconnectMatterStore()
      try {
        const { POST } = await import('../../app/api/matters/route.ts')
        const { POST: answerWidget } = await import('../../app/api/matters/[matterId]/widgets/[toolCallId]/answer/route.ts')
        const store = await getMatterStore()
        const created = await POST(new Request('http://localhost/api/matters', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        }))
        assert.equal(created.status, 201)
        const body = await created.json()
        const opened = matterOpenedFromCreate(body)
        assert.ok(opened)
        assert.equal(opened.matter.title, 'New chat')
        assert.equal(opened.messages[0]?.text, firstTurnOpeningText())
        assert.equal(opened.messages[1]?.widget?.question, FIRST_TURN_WHERE_QUESTION)
        assert.match(JSON.stringify(opened.messages), /https:\/\/www\.gov\.uk\/find-an-immigration-adviser/)
        assert.doesNotMatch(JSON.stringify(opened.messages), /you will win|Citizens Advice|I act for you/i)
        assert.equal(await getMatterThread(store, 'user_b', opened.matter.id), null)

        const toolCallId = opened.messages[1]?.widget?.toolCallId ?? ''
        const answered = await answerWidget(new Request('http://localhost/api/matters/' + opened.matter.id + '/widgets/' + toolCallId + '/answer', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ choice: 'wales' }),
        }), { params: Promise.resolve({ matterId: opened.matter.id, toolCallId }) })
        assert.equal(answered.status, 200)
        const saved = (await answered.json()) as { followUp?: { text?: string }; message?: { widget?: { answer?: { choice?: string } } } }
        assert.equal(saved.message?.widget?.answer?.choice, 'wales')
        assert.match(saved.followUp?.text ?? '', /https:\/\/www\.gov\.wales\//)
        // C-13: the follow-up carries no AI-generated lead-in; the sticky footer owns the label.
        assert.doesNotMatch(saved.followUp?.text ?? '', /AI-generated information/)

        const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../app/api/matters/route.ts'), 'utf8')
        assert.match(source, /seedMatterFirstTurn/)
        assert.doesNotMatch(source, /generateText|streamText|openai|LiteLLM|CHATLEGAL_OM_MODEL/)
      } finally {
        await disconnectMatterStore()
        if (previousDb === undefined) delete process.env.CHATLEGAL_MATTERS_DB
        else process.env.CHATLEGAL_MATTERS_DB = previousDb
        if (previousSession === undefined) delete process.env.CHATLEGAL_TEST_SESSION
        else process.env.CHATLEGAL_TEST_SESSION = previousSession
        fs.rmSync(dir, { recursive: true, force: true })
      }
    })
  })
})
