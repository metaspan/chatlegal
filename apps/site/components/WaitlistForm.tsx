'use client'

import { useEffect, useRef, useState, type FormEvent } from 'react'
import { honeypotFilled, WAITLIST_ACTION, WAITLIST_PATH, waitlistPayload } from '@/lib/waitlist'

type Grecaptcha = {
  ready: (callback: () => void) => void
  execute: (siteKey: string, options: { action: string }) => Promise<string>
}

declare global {
  interface Window {
    grecaptcha?: Grecaptcha
  }
}

const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY?.trim() ?? ''

export function WaitlistForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [company, setCompany] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const successRef = useRef<HTMLDivElement>(null)
  const open = siteKey.length > 0

  useEffect(() => {
    if (!open) return
    if (document.querySelector('script[data-recaptcha="v3"]')) return
    const script = document.createElement('script')
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`
    script.async = true
    script.dataset.recaptcha = 'v3'
    document.head.appendChild(script)
  }, [open])

  useEffect(() => {
    if (status !== 'sent') return
    successRef.current?.focus()
  }, [status])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!open || status === 'sending') return

    if (honeypotFilled(company)) {
      setStatus('sent')
      setMessage("You're on the list.")
      return
    }

    setStatus('sending')
    setMessage('')

    try {
      const token = await recaptchaToken(siteKey)
      const response = await fetch(WAITLIST_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(waitlistPayload({ email, name, note, recaptchaToken: token })),
      })
      if (!response.ok) {
        setStatus('error')
        setMessage(
          response.status === 404 || response.status === 405
            ? "The waitlist isn't accepting signups yet."
            : "That didn't send. Try again in a moment.",
        )
        return
      }
      const body = (await response.json().catch(() => null)) as { ok?: boolean } | null
      if (!body?.ok) {
        setStatus('error')
        setMessage("That didn't send. Try again in a moment.")
        return
      }
      setStatus('sent')
      setMessage("You're on the list.")
    } catch {
      setStatus('error')
      setMessage("The waitlist isn't accepting signups yet.")
    }
  }

  if (status === 'sent') {
    const address = email.trim()
    return (
      <div className="waitlist-success" role="status" tabIndex={-1} ref={successRef}>
        <h3>{message}</h3>
        <p>
          {address
            ? `We'll email you at ${address} when the beta opens.`
            : "We'll email you when the beta opens."}
        </p>
      </div>
    )
  }

  const sending = status === 'sending'

  return (
    <form className="waitlist" onSubmit={onSubmit} noValidate={false} aria-busy={sending}>
      {!open ? <p className="waitlist-note">Waitlist opening soon.</p> : null}
      <label>
        Name <span>optional</span>
        <input
          name="name"
          type="text"
          autoComplete="name"
          maxLength={120}
          value={name}
          disabled={!open || sending}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label>
        Email
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={254}
          value={email}
          disabled={!open || sending}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <label>
        Note <span>optional</span>
        <textarea
          name="note"
          rows={3}
          maxLength={1000}
          value={note}
          disabled={!open || sending}
          onChange={(event) => setNote(event.target.value)}
        />
      </label>
      <div className="waitlist-hp" aria-hidden="true">
        <label>
          Company
          <input
            name="company"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={company}
            onChange={(event) => setCompany(event.target.value)}
          />
        </label>
      </div>
      {sending ? (
        <p className="waitlist-sending" role="status">
          Sending your details…
        </p>
      ) : null}
      {status === 'error' ? (
        <p className="waitlist-error" id="waitlist-error" role="alert">
          {message}
        </p>
      ) : null}
      <button
        className="home-cta"
        type="submit"
        disabled={!open || sending}
        aria-describedby={status === 'error' ? 'waitlist-error' : undefined}
      >
        {sending ? 'Sending…' : status === 'error' ? 'Try again' : 'Join the waitlist'}
      </button>
      {open ? (
        <p className="waitlist-fine">
          Protected by reCAPTCHA. Google&apos;s{' '}
          <a href="https://policies.google.com/privacy">Privacy Policy</a> and{' '}
          <a href="https://policies.google.com/terms">Terms</a> apply.
        </p>
      ) : null}
    </form>
  )
}

function recaptchaToken(key: string): Promise<string> {
  const captcha = window.grecaptcha
  if (!captcha) return Promise.reject(new Error('recaptcha'))
  return new Promise((resolve, reject) => {
    captcha.ready(() => {
      captcha.execute(key, { action: WAITLIST_ACTION }).then(resolve, reject)
    })
  })
}
