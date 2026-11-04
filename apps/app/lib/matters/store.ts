import { randomUUID } from 'node:crypto'
import type { MastraDBMessage } from '@mastra/core/agent'
import { isObservationalMemoryEnabled, type StorageThreadType } from '@mastra/core/memory'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'
import {
  ASK_CHOICE_NAME,
  ASK_CHOICE_VERSION,
  acceptChoiceAnswer,
  askChoiceToolArgs,
  askChoiceToolResult,
  messageHasAskChoice,
  presentAskChoice,
  readMatterAskChoice,
  readStoredAskChoice,
  type AskChoiceProps,
} from './ask-choice'
import { ensureMattersDatabaseDirectory, mattersDatabaseAuthToken, mattersDatabaseUrl } from './database-url'
import { matterObservationSummary, matterObservationalMemoryConfig } from './observational-memory'
import { matterMessageText, matterMessageTools, toIso } from './present'
import { MATTER_KIND, matterResourceId } from './resource'
import { resolveMatterTitle } from './title'
import type { MatterMessage, MatterObservations, MatterSummary, MatterThread } from './types'

/**
 * Matter sessions on Mastra memory.
 * One matter is one thread. The resource id is the Clerk user
 * (see resource.ts, adapted from dcolley/tourbillon@7a8595b
 * apps/web/lib/assistant/threads.ts).
 *
 * Storage is @mastra/libsql. The default URL is a local SQLite file, so the
 * .34 host needs no database secret. Set CHATLEGAL_MATTERS_DB to move the
 * file, or to a libsql:// URL with CHATLEGAL_MATTERS_AUTH_TOKEN. Postgres is
 * a later swap to @mastra/pg; list/create/read stay the same.
 *
 * Observational memory is set on this Memory instance and scoped to the
 * thread, which is the matter. The observer model stays off unless
 * CHATLEGAL_OM_ENABLED and CHATLEGAL_OM_MODEL are both set. Semantic recall
 * stays off. See observational-memory.ts.
 */

export type MatterStore = {
  url: string
  memory: Memory
  close: () => Promise<void>
}

const globalForMatters = globalThis as { chatlegalMatterStore?: Promise<MatterStore> }

export async function createMatterStore(
  url: string = mattersDatabaseUrl(),
  options: { authToken?: string; id?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<MatterStore> {
  ensureMattersDatabaseDirectory(url)
  const authToken = options.authToken ?? mattersDatabaseAuthToken(url)
  const storage = new LibSQLStore({
    id: options.id ?? `chatlegal-matters-${randomUUID()}`,
    url,
    ...(authToken ? { authToken } : {}),
  })
  const memory = new Memory({
    storage,
    options: {
      lastMessages: 40,
      semanticRecall: false,
      generateTitle: false,
      observationalMemory: matterObservationalMemoryConfig(options.env ?? process.env),
    },
  })
  await storage.init()
  return {
    url,
    memory,
    close: async () => {
      await memory.settled()
      await storage.close()
    },
  }
}

/** Drops the process-wide store. Tests use this before pointing at another file. */
export async function disconnectMatterStore(): Promise<void> {
  const pending = globalForMatters.chatlegalMatterStore
  globalForMatters.chatlegalMatterStore = undefined
  if (!pending) return
  const store = await pending.catch(() => null)
  await store?.close()
}

export function getMatterStore(): Promise<MatterStore> {
  if (!globalForMatters.chatlegalMatterStore) {
    const pending = createMatterStore(mattersDatabaseUrl(), { id: 'chatlegal-matters' }).catch((error: unknown) => {
      globalForMatters.chatlegalMatterStore = undefined
      throw error
    })
    globalForMatters.chatlegalMatterStore = pending
  }
  return globalForMatters.chatlegalMatterStore
}

function toSummary(thread: StorageThreadType): MatterSummary {
  return {
    id: thread.id,
    title: thread.title?.trim() || resolveMatterTitle(undefined),
    createdAt: toIso(thread.createdAt),
    updatedAt: toIso(thread.updatedAt),
  }
}

function isOwnedMatter(thread: StorageThreadType, resourceId: string): boolean {
  return thread.resourceId === resourceId && thread.metadata?.kind === MATTER_KIND
}

export async function createMatter(
  store: MatterStore,
  userId: string,
  input: { title?: string } = {},
): Promise<MatterSummary> {
  const title = resolveMatterTitle(input.title)
  const thread = await store.memory.createThread({
    threadId: randomUUID(),
    resourceId: matterResourceId(userId),
    title,
    metadata: { kind: MATTER_KIND },
  })
  return toSummary(thread)
}

export async function listMatters(store: MatterStore, userId: string): Promise<MatterSummary[]> {
  const resourceId = matterResourceId(userId)
  const threads: StorageThreadType[] = []
  for (let page = 0; page < 20; page += 1) {
    const listed = await store.memory.listThreads({
      page,
      perPage: 100,
      orderBy: { field: 'updatedAt', direction: 'DESC' },
      filter: { resourceId, metadata: { kind: MATTER_KIND } },
    })
    threads.push(...listed.threads)
    if (!listed.hasMore) break
  }
  return threads
    .filter((thread) => isOwnedMatter(thread, resourceId))
    .map(toSummary)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
}

async function ownedThread(
  store: MatterStore,
  userId: string,
  matterId: string,
): Promise<StorageThreadType | null> {
  if (!matterId.trim()) return null
  const resourceId = matterResourceId(userId)
  const thread = await store.memory.getThreadById({ threadId: matterId, resourceId })
  if (!thread || !isOwnedMatter(thread, resourceId)) return null
  return thread
}

/** True when this Clerk user owns the matter thread. A stranger's id is false. */
export async function userOwnsMatter(store: MatterStore, userId: string, matterId: string): Promise<boolean> {
  return (await ownedThread(store, userId, matterId)) !== null
}

export async function getMatterThread(
  store: MatterStore,
  userId: string,
  matterId: string,
): Promise<MatterThread | null> {
  const thread = await ownedThread(store, userId, matterId)
  if (!thread) return null
  const resourceId = matterResourceId(userId)
  const recalled = await store.memory.recall({
    threadId: matterId,
    resourceId,
    perPage: false,
    orderBy: { field: 'createdAt', direction: 'ASC' },
  })
  const messages = recalled.messages
    .map((message) => toMatterMessage(message))
    .filter((message): message is MatterMessage => message !== null)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return {
    matter: toSummary(thread),
    messages,
    observations: await readMatterObservations(store, resourceId, matterId),
  }
}

/**
 * Reads the summary stored for this thread only.
 * The lookup key is the matter id. A resource-scoped row is a different key
 * and is not read here.
 */
async function readMatterObservations(
  store: MatterStore,
  resourceId: string,
  matterId: string,
): Promise<MatterObservations> {
  const enabled = isObservationalMemoryEnabled(store.memory.getMergedThreadConfig().observationalMemory)
  const domain = await store.memory.storage.getStore('memory')
  if (!domain?.supportsObservationalMemory) return { enabled, summary: '' }
  const record = await domain.getObservationalMemory(matterId, resourceId)
  return {
    enabled,
    summary: matterObservationSummary(record, { matterId, resourceId }),
  }
}

function messageCreatedAt(value: Date | undefined): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value
  return new Date()
}

/**
 * Records a message on a matter the user owns.
 * The centre composer calls this for the user's own words.
 * The scripted first turn also stores its notice here.
 * TODO(G-01 Concierge): stream the assistant reply after that message is stored.
 * This function does not call a model.
 */
export async function appendMatterMessage(
  store: MatterStore,
  userId: string,
  matterId: string,
  input: { role: MatterMessage['role']; text: string; createdAt?: Date },
): Promise<MatterMessage | null> {
  const thread = await ownedThread(store, userId, matterId)
  if (!thread) return null
  const resourceId = matterResourceId(userId)
  const createdAt = messageCreatedAt(input.createdAt)
  const message: MastraDBMessage = {
    id: randomUUID(),
    role: input.role,
    createdAt,
    threadId: matterId,
    resourceId,
    content: {
      format: 2,
      parts: [{ type: 'text', text: input.text }],
    },
  }
  await store.memory.saveMessages({ messages: [message] })
  await store.memory.updateThread({
    id: matterId,
    title: thread.title,
    metadata: { ...(thread.metadata ?? {}), kind: MATTER_KIND },
  })
  return {
    id: message.id,
    role: input.role,
    text: input.text,
    createdAt: createdAt.toISOString(),
  }
}

const askChoiceLocks = new Map<string, Promise<void>>()

/**
 * One answer at a time for a card. A second pick waits, then sees the first
 * result and is refused. This is the in-process form of the submit gate in
 * hitly-net/hitly@94b2e92 apps/app/components/answer-form.tsx.
 */
function withAskChoiceLock<T>(key: string, run: () => Promise<T>): Promise<T> {
  const previous = askChoiceLocks.get(key) ?? Promise.resolve()
  let release: () => void = () => {}
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  const tail = previous.then(() => gate)
  askChoiceLocks.set(key, tail)
  return previous.then(run, run).finally(() => {
    release()
    if (askChoiceLocks.get(key) === tail) askChoiceLocks.delete(key)
  })
}

function toMatterMessage(message: {
  id: string
  role: string
  content: MastraDBMessage['content']
  createdAt: Date | string
}): MatterMessage | null {
  if (message.role !== 'user' && message.role !== 'assistant') return null
  const role = message.role
  const widget = role === 'assistant' ? readMatterAskChoice(message.content) : null
  const tools = role === 'assistant'
    ? matterMessageTools(message.content).filter((tool) => !widget || tool.name !== ASK_CHOICE_NAME)
    : []
  return {
    id: message.id,
    role,
    text: matterMessageText(message.content),
    createdAt: toIso(message.createdAt),
    ...(tools.length > 0 ? { tools } : {}),
    ...(widget ? { widget } : {}),
  }
}

/**
 * Stores an askChoice card on a matter the user owns.
 * There is no model call. TODO(G-01 Concierge): call this when the model asks.
 */
export async function appendAskChoice(
  store: MatterStore,
  userId: string,
  matterId: string,
  props: AskChoiceProps,
  options: { createdAt?: Date } = {},
): Promise<MatterMessage | null> {
  const thread = await ownedThread(store, userId, matterId)
  if (!thread) return null
  const resourceId = matterResourceId(userId)
  const createdAt = messageCreatedAt(options.createdAt)
  const toolCallId = randomUUID()
  const message: MastraDBMessage = {
    id: randomUUID(),
    role: 'assistant',
    createdAt,
    threadId: matterId,
    resourceId,
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'call',
            toolCallId,
            toolName: ASK_CHOICE_NAME,
            args: askChoiceToolArgs(props, ASK_CHOICE_VERSION),
          },
        },
      ],
    },
  }
  await store.memory.saveMessages({ messages: [message] })
  await store.memory.updateThread({
    id: matterId,
    title: thread.title,
    metadata: { ...(thread.metadata ?? {}), kind: MATTER_KIND },
  })
  return toMatterMessage(message)
}

export type AnswerAskChoiceResult =
  | { ok: true; message: MatterMessage }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'invalid'; issues: string[] }
  | { ok: false; reason: 'answered'; message: MatterMessage }

/**
 * Records one pick on an askChoice card. A card that already has a result is
 * left as it was. The pick has to be one of the options stored with the card.
 */
export async function answerAskChoice(
  store: MatterStore,
  userId: string,
  matterId: string,
  toolCallId: string,
  answer: unknown,
): Promise<AnswerAskChoiceResult> {
  const id = toolCallId.trim()
  if (!id) return { ok: false, reason: 'missing' }
  return withAskChoiceLock(`${matterId}:${id}`, async () => {
    const thread = await ownedThread(store, userId, matterId)
    if (!thread) return { ok: false, reason: 'missing' }
    const resourceId = matterResourceId(userId)
    const recalled = await store.memory.recall({
      threadId: matterId,
      resourceId,
      perPage: false,
      orderBy: { field: 'createdAt', direction: 'ASC' },
    })
    const message = recalled.messages.find(
      (item) => item.role === 'assistant' && messageHasAskChoice(item.content, id),
    )
    if (!message) return { ok: false, reason: 'missing' }
    const shown = toMatterMessage(message)
    if (!shown) return { ok: false, reason: 'missing' }
    const call = readStoredAskChoice(message.content)
    if (call?.toolCallId === id && call.state === 'result') {
      return { ok: false, reason: 'answered', message: shown }
    }
    if (!call || call.toolCallId !== id) return { ok: false, reason: 'invalid', issues: ['(props): invalid'] }
    const accepted = acceptChoiceAnswer(call.props, answer)
    if (!accepted.ok) return { ok: false, reason: 'invalid', issues: accepted.issues }
    const answeredAt = Date.now()
    const parts = message.content.parts.map((part) => {
      if (part.type !== 'tool-invocation') return part
      if (part.toolInvocation.toolCallId !== id || part.toolInvocation.toolName !== ASK_CHOICE_NAME) return part
      return {
        ...part,
        updatedAt: answeredAt,
        toolInvocation: {
          state: 'result' as const,
          toolCallId: id,
          toolName: ASK_CHOICE_NAME,
          args: part.toolInvocation.args,
          result: askChoiceToolResult(call.version, accepted.answer),
        },
      }
    })
    await store.memory.updateMessages({
      messages: [{ id: message.id, content: { ...message.content, parts } }],
    })
    const widget = presentAskChoice({
      toolCallId: id,
      version: call.version,
      props: call.props,
      status: 'answered',
      answer: accepted.answer,
      answeredAt: new Date(answeredAt).toISOString(),
    })
    return {
      ok: true,
      message: {
        ...shown,
        tools: shown.tools?.filter((tool) => tool.name !== ASK_CHOICE_NAME),
        widget,
      },
    }
  })
}
