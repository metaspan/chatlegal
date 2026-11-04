/** mammoth 1.13 ships no types. Only the plain-text reader is used. */
declare module 'mammoth' {
  export function extractRawText(input: { buffer: Buffer }): Promise<{ value: string }>
}
