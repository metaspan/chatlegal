import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VIEWER_KINDS, isViewerKind, viewerPanelCopy } from './viewer-kind.ts'

describe('viewer kinds', () => {
  it('covers markdown, image, pdf, and chat state', () => {
    assert.deepEqual(VIEWER_KINDS, ['markdown', 'image', 'pdf', 'chat-state'])
    for (const kind of VIEWER_KINDS) {
      const copy = viewerPanelCopy(kind)
      assert.ok(copy.heading.length > 0)
      assert.ok(copy.body.length > 0)
    }
    assert.match(viewerPanelCopy('markdown').body, /Markdown/)
    assert.match(viewerPanelCopy('pdf').body, /PDF/)
    assert.equal(isViewerKind('image'), true)
    assert.equal(isViewerKind('docx'), false)
  })
})
