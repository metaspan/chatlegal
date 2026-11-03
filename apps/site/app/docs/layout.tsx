import { SiteChrome } from '@/components/SiteChrome'
import { assertSiblingDocs } from '@/lib/docs-source'

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  assertSiblingDocs()
  return <SiteChrome>{children}</SiteChrome>
}
