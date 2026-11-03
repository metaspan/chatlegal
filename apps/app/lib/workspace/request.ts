import type { WorkspaceScope } from './types'

export class WorkspaceRequestError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkspaceRequestError'
  }
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
  const text = await request.text()
  if (!text.trim()) throw new WorkspaceRequestError('The request must be JSON.')
  let body: unknown
  try {
    body = JSON.parse(text) as unknown
  } catch {
    throw new WorkspaceRequestError('The request must be JSON.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WorkspaceRequestError('The request must be a JSON object.')
  }
  return body as Record<string, unknown>
}

export function readFileName(body: Record<string, unknown>): string {
  const name = body.name
  if (typeof name !== 'string') throw new WorkspaceRequestError('File name must be text.')
  return name
}

export function readFileText(body: Record<string, unknown>): string {
  const text = body.text
  if (typeof text !== 'string') throw new WorkspaceRequestError('File text must be text.')
  return text
}

/** Concierge move body: `{ name, from, to }` where each place is the library or a matter. */
export function readMoveBody(body: Record<string, unknown>): { name: string; from: WorkspaceScope; to: WorkspaceScope } {
  return {
    name: readFileName(body),
    from: readScope(body.from, 'From'),
    to: readScope(body.to, 'To'),
  }
}

function readScope(value: unknown, label: string): WorkspaceScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkspaceRequestError(`${label} must say library or matter.`)
  }
  const kind = (value as { kind?: unknown }).kind
  if (kind === 'user') return { kind: 'user' }
  if (kind === 'matter') {
    const matterId = (value as { matterId?: unknown }).matterId
    if (typeof matterId !== 'string' || !matterId.trim()) {
      throw new WorkspaceRequestError('A matter id is required.')
    }
    return { kind: 'matter', matterId: matterId.trim() }
  }
  throw new WorkspaceRequestError(`${label} must be the library or a matter.`)
}
