import type { Metadata } from 'next'
import { Atkinson_Hyperlegible, Newsreader } from 'next/font/google'
import Script from 'next/script'
import { ScrollReveal } from '@/components/ScrollReveal'
import './globals.css'

const sans = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-sans',
  display: 'swap',
})

const serif = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-serif',
  display: 'swap',
})

const themeInit = `(function(){try{var s=localStorage.getItem('theme');var t=s==='light'||s==='dark'?s:(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');if(t==='dark')document.documentElement.setAttribute('data-theme','dark');}catch(e){}})();`

export const metadata: Metadata = {
  metadataBase: new URL('https://chatlegal.uk'),
  title: {
    default: 'ChatLegal',
    template: '%s · ChatLegal docs',
  },
  description: 'UK citizen legal information. Not a solicitor. Not legal advice.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${sans.variable} ${serif.variable}`} suppressHydrationWarning>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <ScrollReveal />
        {children}
      </body>
    </html>
  )
}
