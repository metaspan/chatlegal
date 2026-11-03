import { NextResponse } from 'next/server'
import { WorkspaceConflictError, WorkspacePathError } from './paths'
import { WorkspaceRequestError } from './request'
import type { MoveWorkspaceFileResult } from './types'

export function workspaceErrorResponse(error: unknown, fallback: string): NextResponse {
  if (error instanceof WorkspaceRequestError || error instanceof WorkspacePathError) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }
  if (error instanceof WorkspaceConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 })
  }
  console.error(fallback, error)
  return NextResponse.json({ error: fallback }, { status: 500 })
}

export function moveErrorResponse(result: Extract<MoveWorkspaceFileResult, { ok: false }>): NextResponse {
  if (result.reason === 'conflict') {
    return NextResponse.json({ error: 'A file with that name is already there.' }, { status: 409 })
  }
  if (result.reason === 'matter') {
    return NextResponse.json({ error: 'Matter not found.' }, { status: 404 })
  }
  return NextResponse.json({ error: 'File not found.' }, { status: 404 })
}
