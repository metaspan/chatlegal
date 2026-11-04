import { isDocxFileName, isPdfFileName } from './chunk'

/**
 * Plain text from a stored PDF or Word file, for the file index only.
 * The uploaded bytes stay as they are. A scanned PDF has no text layer
 * and comes back empty. There is no OCR.
 * The readers load only when a file is prepared, so search that is off
 * does not open them. Chat does not call this.
 */

export type ExtractedText = { ok: true; text: string } | { ok: false }

export async function extractIndexText(name: string, bytes: Buffer): Promise<ExtractedText> {
  try {
    if (isPdfFileName(name)) return { ok: true, text: await pdfText(bytes) }
    if (isDocxFileName(name)) return { ok: true, text: await docxText(bytes) }
    return { ok: false }
  } catch {
    console.error('File search could not read a document.')
    return { ok: false }
  }
}

async function pdfText(bytes: Buffer): Promise<string> {
  const { extractText, getDocumentProxy } = await import('unpdf')
  const pdf = await getDocumentProxy(new Uint8Array(bytes), { verbosity: 0 })
  try {
    const extracted = await extractText(pdf, { mergePages: true })
    return Array.isArray(extracted.text) ? extracted.text.join('\n') : extracted.text
  } finally {
    await pdf.cleanup().catch(() => undefined)
  }
}

async function docxText(bytes: Buffer): Promise<string> {
  const { extractRawText } = await import('mammoth')
  const result = await extractRawText({ buffer: bytes })
  return result.value
}
