import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { chunkWorkspaceText } from './chunk.ts'
import { extractIndexText } from './extract.ts'
import { docxWithText, docxWithoutText, pdfWithText, pdfWithoutText } from './office-samples.test.ts'

describe('PDF and Word text for the file index', () => {
  it('reads the words in a PDF and a Word file', async () => {
    const pdf = await extractIndexText('letter.PDF', await pdfWithText('depositlettertoken in the agreement'))
    assert.equal(pdf.ok, true)
    if (pdf.ok) assert.match(pdf.text, /depositlettertoken in the agreement/)

    const word = await extractIndexText('reply.docx', docxWithText('wordagreementtoken in the reply'))
    assert.equal(word.ok, true)
    if (word.ok) {
      assert.match(word.text, /wordagreementtoken in the reply/)
      assert.ok(chunkWorkspaceText(word.text).chunks.length > 0)
    }
  })

  it('treats an empty PDF or Word file as having no words', async () => {
    const pdf = await extractIndexText('blank.pdf', await pdfWithoutText())
    assert.equal(pdf.ok, true)
    if (pdf.ok) assert.deepEqual(chunkWorkspaceText(pdf.text), { chunks: [], truncated: false })

    const word = await extractIndexText('blank.docx', docxWithoutText())
    assert.equal(word.ok, true)
    if (word.ok) assert.deepEqual(chunkWorkspaceText(word.text), { chunks: [], truncated: false })
  })

  it('does not return the bytes of a corrupt PDF or Word file', async () => {
    const pdf = await extractIndexText('broken.pdf', Buffer.from('%PDF-1.4 corruptpdfsecret'))
    assert.deepEqual(pdf, { ok: false })

    const word = await extractIndexText('broken.docx', Buffer.from('not-a-docx corruptdocxsecret'))
    assert.deepEqual(word, { ok: false })

    const empty = await extractIndexText('empty.pdf', Buffer.alloc(0))
    assert.deepEqual(empty, { ok: false })
  })

  it('leaves Markdown to the text reader', async () => {
    const markdown = await extractIndexText('note.md', Buffer.from('markdownnotetoken'))
    assert.deepEqual(markdown, { ok: false })
  })
})
