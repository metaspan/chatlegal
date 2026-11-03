import { normaliseHref } from '@/lib/nav'

const repo = 'https://github.com/metaspan/chatlegal'

/** Repo path for the MDX page that renders this docs route. */
export function docsPageFile(pathname: string): string | null {
  const href = normaliseHref(pathname)
  if (href !== '/docs/' && !href.startsWith('/docs/')) return null
  const rest = href.slice('/docs/'.length).replace(/\/$/, '')
  if (rest === '') return 'apps/site/app/docs/page.mdx'
  if (rest.split('/').some((part) => part === '' || part === '.' || part === '..')) return null
  return `apps/site/app/docs/${rest}/page.mdx`
}

export function suggestEditHref(pathname: string): string | null {
  const file = docsPageFile(pathname)
  return file ? `${repo}/edit/main/${file}` : null
}
