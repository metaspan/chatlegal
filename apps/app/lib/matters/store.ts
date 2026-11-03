import { randomUUID } from 'node:crypto'
import type { MastraDBMessage } from '@mastra/core/agent'
import type { StorageThreadType } from '@mastra/core/memory'
import { LibSQLStore } from '@mastra/libsql'
import { Memory } from '@mastra/memory'
import { ensureMattersDatabaseDirectory, mattersDatabaseAuthToken, mattersDatabaseUrl } from './database-url'
import { matterMessageText, toIso } from './present'
import { MATTER_KIND, matterResourceId } from './resource'
import { resolveMatterTitle } from './title'
import type { MatterMessage, MatterSummary, MatterThread } from './types'

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
 * Observational memory and semantic recall stay off. Those are later slices.
 */

export type MatterStore = {
  url: string
  memory: Memory
  close: () => Promise<void>
}

const globalForMatters = globalThis as { chatlegalMatterStore?: Promise<MatterStore> }

export async function createMatterStore(
  url: string = mattersDatabaseUrl(),
  options: { authToken?: string; id?: string } = {},
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
      observationalMemory: false,
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
    .filter((message) => message.role === 'user' || message.role === 'assistant')
    .map((message) => ({
      id: message.id,
      role: message.role as MatterMessage['role'],
      text: matterMessageText(message.content),
      createdAt: toIso(message.createdAt),
    }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))
  return { matter: toSummary(thread), messages }
}

/**
 * Records a message on a matter the user owns.
 * The composer does not call this yet: sending stays off until a model exists.
 * The centre pane reads whatever is already stored on the thread.
 */
export async function appendMatterMessage(
  store: MatterStore,
  userId: string,
  matterId: string,
  input: { role: MatterMessage['role']; text: string },
): Promise<MatterMessage | null> {
  const thread = await ownedThread(store, userId, matterId)
  if (!thread) return null
  const resourceId = matterResourceId(userId)
  const createdAt = new Date()
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
