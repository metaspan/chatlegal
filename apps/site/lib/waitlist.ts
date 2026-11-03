export const WAITLIST_SOURCE = 'chatlegal.uk'
export const WAITLIST_ACTION = 'waitlist'
export const WAITLIST_PATH = '/api/waitlist'

export function waitlistPayload(input: {
  email: string
  name: string
  note: string
  recaptchaToken: string
}) {
  return {
    email: input.email.trim(),
    name: input.name.trim(),
    note: input.note.trim(),
    source: WAITLIST_SOURCE,
    recaptchaToken: input.recaptchaToken,
  }
}

export function honeypotFilled(value: string): boolean {
  return value.trim().length > 0
}
