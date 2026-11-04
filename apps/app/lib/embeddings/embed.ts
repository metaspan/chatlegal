import { embeddingsEndpoint, type EmbeddingConfig } from './config'
import { EmbeddingUnavailableError } from './errors'

/**
 * OpenAI-shaped embeddings HTTP call.
 * The request sends the model id and the text. It does not send a provider secret.
 * TODO(G-00): the concierge proxy stays off. This request is not that proxy.
 * TODO(D-04): chat does not call this.
 */

export type EmbedTexts = (texts: string[]) => Promise<number[][]>

const BATCH = 16

export function httpEmbedder(config: EmbeddingConfig, fetchImpl: typeof fetch = globalThis.fetch): EmbedTexts {
  return async (texts) => {
    let response: Response
    try {
      response = await fetchImpl(embeddingsEndpoint(config.baseUrl), {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify({ model: config.model, input: texts }),
        signal: AbortSignal.timeout(15_000),
      })
    } catch {
      console.error('File search could not reach the embeddings endpoint.')
      throw new EmbeddingUnavailableError()
    }
    if (!response.ok) {
      console.error('File search embeddings endpoint returned', response.status)
      throw new EmbeddingUnavailableError()
    }
    let payload: unknown
    try {
      payload = await response.json()
    } catch {
      throw new EmbeddingUnavailableError()
    }
    return parseEmbeddings(payload, texts.length)
  }
}

export async function embedInBatches(embed: EmbedTexts, texts: string[]): Promise<number[][]> {
  const vectors: number[][] = []
  for (let index = 0; index < texts.length; index += BATCH) {
    const part = texts.slice(index, index + BATCH)
    const got = await embed(part)
    vectors.push(...parseVectorBatch(got, part.length))
  }
  const dimension = vectors[0]?.length ?? 0
  if (!dimension || vectors.some((vector) => vector.length !== dimension)) {
    throw new EmbeddingUnavailableError()
  }
  return vectors
}

function parseEmbeddings(payload: unknown, count: number): number[][] {
  const data = payload && typeof payload === 'object' ? (payload as { data?: unknown }).data : undefined
  if (!Array.isArray(data)) throw new EmbeddingUnavailableError()
  const ordered = data
    .map((row, index) => {
      if (!row || typeof row !== 'object') return null
      const record = row as { index?: unknown; embedding?: unknown }
      const at = typeof record.index === 'number' ? record.index : index
      if (!Array.isArray(record.embedding)) return null
      return { at, embedding: record.embedding }
    })
    .filter((row): row is { at: number; embedding: unknown[] } => row !== null)
    .sort((a, b) => a.at - b.at)
  return parseVectorBatch(
    ordered.map((row) => row.embedding as number[]),
    count,
  )
}

function parseVectorBatch(vectors: number[][], count: number): number[][] {
  if (vectors.length !== count) throw new EmbeddingUnavailableError()
  return vectors.map((vector) => {
    if (!Array.isArray(vector) || vector.length === 0 || vector.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
      throw new EmbeddingUnavailableError()
    }
    return vector
  })
}
