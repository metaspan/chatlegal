/**
 * Stores the scripted first turn on a matter the user owns.
 * This does not call a model. The two scripted cards keep their templated
 * notes on answer (the Concierge resumes only for cards it asked for).
 */
import type { MatterStore } from './store'
import { appendAskChoice, appendMatterMessage, getMatterThread } from './store'
import { firstTurnContinuationText, firstTurnOpeningText, firstTurnPapersProps, firstTurnWhereProps } from './first-turn'
import type { MatterMessage } from './types'

/**
 * Writes the opening notice and the two askChoice cards.
 * Timestamps are a second apart so the centre shows the notice first.
 * Returns null when the matter is not owned by this user.
 */
export async function seedMatterFirstTurn(
  store: MatterStore,
  userId: string,
  matterId: string,
): Promise<MatterMessage[] | null> {
  const start = Date.now()
  const opening = await appendMatterMessage(store, userId, matterId, {
    role: 'assistant',
    text: firstTurnOpeningText(),
    createdAt: new Date(start),
  })
  if (!opening) return null
  const where = await appendAskChoice(store, userId, matterId, firstTurnWhereProps(), {
    createdAt: new Date(start + 1000),
  })
  if (!where) return null
  const papers = await appendAskChoice(store, userId, matterId, firstTurnPapersProps(), {
    createdAt: new Date(start + 2000),
  })
  if (!papers) return null
  const thread = await getMatterThread(store, userId, matterId)
  if (!thread || thread.messages.length < 3) return null
  return thread.messages
}

/**
 * Stores the templated note for a first-turn card that was just answered.
 * A card that is not part of the first turn is left alone.
 * The same note is not stored twice.
 */
export async function appendFirstTurnContinuation(
  store: MatterStore,
  userId: string,
  matterId: string,
  answered: MatterMessage,
): Promise<MatterMessage | null> {
  const text = firstTurnContinuationText(answered)
  if (!text) return null
  const thread = await getMatterThread(store, userId, matterId)
  if (!thread) return null
  const existing = thread.messages.find((message) => message.role === 'assistant' && message.text === text)
  if (existing) return existing
  return appendMatterMessage(store, userId, matterId, { role: 'assistant', text })
}
