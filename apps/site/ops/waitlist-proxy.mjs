/**
 * Verify-forward proxy for the static site. Not part of `out/`.
 *
 * POST /api/waitlist
 *   { email, name, note, source, recaptchaToken, company? }
 * Verifies reCAPTCHA v3 (action "waitlist", score >= 0.5), then POSTs
 * { email, name, note, source } to the webhook. The token, honeypot, and
 * secret never go to the webhook.
 *
 * Env (server only): RECAPTCHA_SECRET_KEY, CHATLEGAL_WAITLIST_WEBHOOK_URL,
 * CHATLEGAL_WAITLIST_WEBHOOK_HEADER (full Authorization value).
 */
import http from 'node:http'

const secret = process.env.RECAPTCHA_SECRET_KEY?.trim() ?? ''
const webhook = process.env.CHATLEGAL_WAITLIST_WEBHOOK_URL?.trim() ?? ''
const authorization = process.env.CHATLEGAL_WAITLIST_WEBHOOK_HEADER?.trim() ?? ''
const port = Number(process.env.WAITLIST_PROXY_PORT ?? 3001)
const host = process.env.WAITLIST_PROXY_HOST ?? '127.0.0.1'
const minScore = 0.5

function send(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
  })
  res.end(data)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 16_384) {
        reject(new Error('too_large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function filled(value) {
  return typeof value === 'string' && value.trim().length > 0
}

async function verify(token, remoteip) {
  const body = new URLSearchParams({ secret, response: token })
  if (remoteip) body.set('remoteip', remoteip)
  const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!response.ok) return { success: false }
  return response.json()
}

const server = http.createServer(async (req, res) => {
  const path = (req.url ?? '').split('?')[0]
  if (req.method !== 'POST' || path !== '/api/waitlist') {
    send(res, 404, { ok: false, error: 'not_found' })
    return
  }

  let payload
  try {
    payload = JSON.parse(await readBody(req))
  } catch {
    send(res, 400, { ok: false, error: 'email' })
    return
  }

  if (filled(payload.company) || filled(payload.website)) {
    send(res, 200, { ok: true })
    return
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  const name = typeof payload.name === 'string' ? payload.name.trim() : ''
  const note = typeof payload.note === 'string' ? payload.note.trim() : ''
  const token = typeof payload.recaptchaToken === 'string' ? payload.recaptchaToken.trim() : ''
  if (!email.includes('@') || email.length > 254 || !token) {
    send(res, 400, { ok: false, error: 'email' })
    return
  }

  if (!secret || !webhook) {
    send(res, 503, { ok: false, error: 'unconfigured' })
    return
  }

  try {
    const remoteip = String(req.headers['x-forwarded-for'] ?? '')
      .split(',')[0]
      .trim()
    const verdict = await verify(token, remoteip)
    const passed =
      verdict.success === true &&
      verdict.action === 'waitlist' &&
      typeof verdict.score === 'number' &&
      verdict.score >= minScore
    if (!passed) {
      send(res, 400, { ok: false, error: 'captcha' })
      return
    }

    const forwarded = await fetch(webhook, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(authorization ? { authorization } : {}),
      },
      body: JSON.stringify({
        email,
        name,
        note,
        source: 'chatlegal.uk',
      }),
    })
    if (!forwarded.ok) {
      send(res, 502, { ok: false, error: 'webhook' })
      return
    }
    send(res, 200, { ok: true })
  } catch {
    send(res, 502, { ok: false, error: 'webhook' })
  }
})

server.listen(port, host, () => {
  console.log(`waitlist proxy on http://${host}:${port}/api/waitlist`)
})
