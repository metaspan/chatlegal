import type { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'
import { AuthScreen } from '@/components/auth-screen'
import { APP_AFTER_AUTH_URL, APP_SIGN_UP_URL } from '@/lib/clerk-host'

export const metadata: Metadata = { title: 'Sign in' }

export default function SignInPage() {
  return (
    <AuthScreen>
      <SignIn routing="path" path="/sign-in" signUpUrl={APP_SIGN_UP_URL} fallbackRedirectUrl={APP_AFTER_AUTH_URL} />
    </AuthScreen>
  )
}
