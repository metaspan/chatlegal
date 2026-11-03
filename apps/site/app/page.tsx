import type { Metadata } from 'next'
import { Banner } from '@/components/Banner'

export const metadata: Metadata = {
  title: { absolute: 'ChatLegal' },
  description: 'UK citizen legal information. Not a solicitor. Not legal advice.',
  alternates: { canonical: '/docs/' },
  robots: { index: false, follow: true },
}

export default function HomePage() {
  return (
    <main className="home">
      <meta httpEquiv="refresh" content="0; url=/docs/" />
      <Banner />
      <div className="home-panel">
        <p className="eyebrow">chatlegal.uk</p>
        <h1>ChatLegal docs</h1>
        <p>Citizen legal information. The docs start at the overview.</p>
        <p>
          <a className="home-cta" href="/docs/">
            Continue to docs
          </a>
        </p>
      </div>
    </main>
  )
}
