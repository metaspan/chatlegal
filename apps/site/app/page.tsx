import type { Metadata } from 'next'
import { Disclaimer } from '@/components/Disclaimer'
import { WaitlistForm } from '@/components/WaitlistForm'

export const metadata: Metadata = {
  title: { absolute: 'ChatLegal' },
  description:
    'UK citizen legal information in plain English, with citations to official sources. Not a solicitor. Not legal advice.',
  alternates: { canonical: '/' },
}

export default function HomePage() {
  return (
    <main className="home">
      <div className="home-rule" aria-hidden="true" />
      <header className="home-bar">
        <a className="home-mark" href="/">
          ChatLegal
        </a>
        <a className="home-docs" href="/docs/">
          Docs
        </a>
      </header>
      <div className="home-wrap">
        <p className="eyebrow">UK citizen legal information</p>
        <h1>Plain English, with the official source beside it.</h1>
        <p className="home-lede">
          ChatLegal explains everyday problems in plain English and points to official sources. It
          is information, triage, and cited retrieval. It is not a solicitor, and it is not Citizens
          Advice.
        </p>
        <div className="home-actions">
          <a className="home-cta" href="#waitlist">
            Join the beta waitlist
          </a>
          <a className="home-secondary" href="/docs/">
            Read the docs
          </a>
        </div>
        <ul className="home-points">
          <li>Plain-English explanations, with citations to official sources.</li>
          <li>A case type and a protocol, rather than an open-ended chat.</li>
          <li>Money, crime, immigration, children, and hard deadlines are handed on to a person or an official process.</li>
        </ul>
        <p className="home-source">
          <a href="https://github.com/metaspan/chatlegal" target="_blank" rel="noopener noreferrer">
            Source & project brief on GitHub
          </a>
        </p>
        <section id="waitlist" className="home-waitlist">
          <h2>Beta waitlist</h2>
          <p>The docs are already published. The product itself is not open yet.</p>
          <WaitlistForm />
        </section>
      </div>
      <Disclaimer />
    </main>
  )
}
