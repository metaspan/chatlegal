import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

/**
 * The page modules run for real. CHATLEGAL_TEST_SESSION stands in for the
 * Clerk session only when NODE_ENV=test (the test script sets that).
 * Redirect comes from next/navigation, not a stub.
 */

type PageComponent = () => Promise<unknown>

function textOf(node: unknown): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (typeof node === 'object' && node !== null && 'props' in node) {
    const props = (node as { props?: { children?: unknown } }).props
    return textOf(props?.children)
  }
  return ''
}

const pages = [
  { title: 'home', module: '../app/(app)/page.tsx' },
  { title: 'matters', module: '../app/(app)/matters/page.tsx' },
  { title: 'work', module: '../app/(app)/work/page.tsx' },
]

describe('guarded pages redirect to /sign-in without a session', () => {
  for (const { title, module } of pages) {
    it(`${title} redirects`, async () => {
      process.env.CHATLEGAL_TEST_SESSION = 'unsigned'
      const { default: page } = (await import(module)) as { default: PageComponent }
      await assert.rejects(
        () => page(),
        (error: unknown) => {
          const detail = `${(error as { digest?: string }).digest ?? ''} ${(error as Error).message ?? ''}`
          assert.match(detail, /NEXT_REDIRECT/, `${title} must throw the redirect signal`)
          assert.match(detail, /\/sign-in/, `${title} must redirect to /sign-in, got: ${detail}`)
          return true
        },
      )
    })
  }
})

describe('signed-in home shows the Consumer session', () => {
  it('renders the test user id and does not claim to act for the user', async () => {
    process.env.CHATLEGAL_TEST_SESSION = 'signed-in'
    const { default: page } = (await import('../app/(app)/page.tsx')) as { default: PageComponent }
    const text = textOf(await page())
    assert.match(text, /Signed in/)
    assert.match(text, /Personal account/)
    assert.match(text, /user_test/)
    assert.match(text, /sess_test/)
    assert.doesNotMatch(text, /I act for you|your solicitor|we represent/i)
  })
})
