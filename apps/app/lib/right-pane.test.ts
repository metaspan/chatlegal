import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultRightPaneView,
  dismissRightPaneDocument,
  openedViewerLabel,
  openRightPaneDocument,
  openRightPaneMatterView,
  retainOpenedDocument,
  rightPaneKind,
  viewerKindForFileName,
  workspaceContentPath,
} from './right-pane.ts'

describe('right pane', () => {
  it('rests on chat state, opens a document viewer, and dismisses back', () => {
    const resting = defaultRightPaneView()
    assert.equal(resting.mode, 'chat-state')
    assert.equal(resting.document, null)
    assert.equal(rightPaneKind(resting), 'chat-state')

    const opened = openRightPaneDocument({ name: 'notice.pdf', scope: 'matter', matterId: 'matter-1' })
    assert.equal(opened.mode, 'document')
    assert.equal(rightPaneKind(opened), 'pdf')
    assert.equal(opened.document?.name, 'notice.pdf')
    assert.equal(opened.document?.scope, 'matter')
    assert.equal(opened.document?.matterId, 'matter-1')

    const restored = dismissRightPaneDocument()
    assert.equal(restored.mode, 'chat-state')
    assert.equal(restored.document, null)
    assert.equal(rightPaneKind(restored), 'chat-state')
  })

  it('picks markdown, image, pdf, or the other-file viewer from the name', () => {
    assert.equal(viewerKindForFileName('letter.md'), 'markdown')
    assert.equal(viewerKindForFileName('Letter.MARKDOWN'), 'markdown')
    assert.equal(viewerKindForFileName('photo.PNG'), 'image')
    assert.equal(viewerKindForFileName('scan.jpeg'), 'image')
    assert.equal(viewerKindForFileName('Deed.PDF'), 'pdf')
    assert.equal(viewerKindForFileName('letter.DOCX'), 'docx')
    assert.equal(viewerKindForFileName('notes.txt'), 'markdown')
    assert.equal(viewerKindForFileName('bundle'), 'markdown')

    assert.equal(openedViewerLabel('letter.md', 'markdown'), 'Markdown')
    assert.equal(openedViewerLabel('photo.png', 'image'), 'Image')
    assert.equal(openedViewerLabel('notice.pdf', 'pdf'), 'PDF')
    assert.equal(openedViewerLabel('letter.docx', 'docx'), 'Word document')
    assert.equal(openedViewerLabel('notes.txt', 'markdown'), 'File')

    const libraryFile = openRightPaneDocument({
      name: ' photo.jpg ',
      scope: 'user',
      matterId: 'matter-1',
    })
    assert.equal(libraryFile.document?.name, 'photo.jpg')
    assert.equal(libraryFile.document?.kind, 'image')
    assert.equal(libraryFile.document?.matterId, null)
    assert.equal(openRightPaneDocument({ name: '   ', scope: 'user' }).mode, 'chat-state')
  })

  it('drops a matter file when that matter is no longer open', () => {
    const matterFile = openRightPaneDocument({ name: 'reply.txt', scope: 'matter', matterId: 'matter-1' })
    assert.equal(retainOpenedDocument(matterFile, 'matter-1'), matterFile)
    assert.equal(retainOpenedDocument(matterFile, 'matter-2').mode, 'chat-state')
    assert.equal(retainOpenedDocument(matterFile, null).mode, 'chat-state')

    const libraryFile = openRightPaneDocument({ name: 'notice.pdf', scope: 'user' })
    assert.equal(retainOpenedDocument(libraryFile, null), libraryFile)
    assert.equal(retainOpenedDocument(libraryFile, 'matter-9'), libraryFile)
    assert.equal(retainOpenedDocument(defaultRightPaneView(), 'matter-1').mode, 'chat-state')
  })

  it('opens people, dates, or status, and dismiss returns to chat state', () => {
    for (const mode of ['parties', 'dates', 'status'] as const) {
      const opened = openRightPaneMatterView(mode)
      assert.equal(opened.mode, mode)
      assert.equal(opened.document, null)
      assert.equal(rightPaneKind(opened), mode)
      assert.equal(retainOpenedDocument(opened, null), opened)
    }
    assert.equal(dismissRightPaneDocument().mode, 'chat-state')
    assert.equal(
      workspaceContentPath({ name: 'letter.md', scope: 'user', matterId: 'matter-1' }),
      '/api/workspace/content?name=letter.md&scope=user',
    )
    assert.equal(
      workspaceContentPath({ name: 'photo.png', scope: 'matter', matterId: 'matter-1' }),
      '/api/workspace/content?name=photo.png&scope=matter&matterId=matter-1',
    )
  })
})
