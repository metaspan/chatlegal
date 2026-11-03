import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function walk(dir: string): string[] {
  const found: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.next') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) found.push(...walk(full))
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) found.push(full)
  }
  return found
}

describe('Consumer-only app surface', () => {
  it('does not pull in organizations, better-auth, or other product brands', () => {
    const files = [
      ...walk(path.join(appDir, 'app')),
      ...walk(path.join(appDir, 'components')),
      ...walk(path.join(appDir, 'lib')),
      path.join(appDir, 'proxy.ts'),
    ]
    assert.ok(files.length > 10)
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8')
      const rel = path.relative(appDir, file)
      assert.doesNotMatch(source, /OrganizationSwitcher|useOrganization\b|better-auth|CompanySwitcher/, rel)
      assert.doesNotMatch(source, /Tourbillon/, rel)
      assert.doesNotMatch(source, /I act for you/i, rel)
      assert.doesNotMatch(source, /hitly-cloud|@hitly\b|stripe/i, rel)
      assert.doesNotMatch(source, /tourbillon\.chat|@tourbillon/, rel)
      if (rel.startsWith('components/') || (rel.startsWith('app/') && !rel.startsWith('app/api/'))) {
        assert.doesNotMatch(source, /@mastra\//, rel)
        assert.doesNotMatch(source, /matters\/store/, rel)
      }
    }
  })
})
