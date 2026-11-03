import type { Metadata } from 'next'
import { Atkinson_Hyperlegible, Newsreader } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { ThemeProvider } from '@/components/theme-provider'
import { clerkAppearance } from '@/lib/clerk-appearance'
import {
  APP_AFTER_AUTH_URL,
  APP_ORIGIN,
  APP_SIGN_IN_URL,
  APP_SIGN_UP_URL,
  allowedRedirectOrigins,
  assertAppClerkHost,
} from '@/lib/clerk-host'
import './globals.css'

const sans = Atkinson_Hyperlegible({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-atkinson',
  display: 'swap',
})

const serif = Newsreader({
  subsets: ['latin'],
  weight: ['500', '600'],
  variable: '--font-newsreader',
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(APP_ORIGIN),
  title: {
    default: 'ChatLegal',
    template: '%s · ChatLegal',
  },
  description: 'Personal ChatLegal account. Not a solicitor. Not legal advice.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  assertAppClerkHost()
  return (
    <html lang="en-GB" className={`${sans.variable} ${serif.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full antialiased">
        <ThemeProvider>
          <ClerkProvider
            appearance={clerkAppearance}
            dynamic
            allowedRedirectOrigins={allowedRedirectOrigins}
            signInUrl={APP_SIGN_IN_URL}
            signUpUrl={APP_SIGN_UP_URL}
            signInFallbackRedirectUrl={APP_AFTER_AUTH_URL}
            signUpFallbackRedirectUrl={APP_AFTER_AUTH_URL}
          >
            {children}
          </ClerkProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
