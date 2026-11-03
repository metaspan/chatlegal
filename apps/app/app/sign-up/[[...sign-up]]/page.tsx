import type { Metadata } from 'next'
import { SignUp } from '@clerk/nextjs'
import { AuthScreen } from '@/components/auth-screen'
import { APP_AFTER_AUTH_URL, APP_SIGN_IN_URL } from '@/lib/clerk-host'

export const metadata: Metadata = { title: 'Sign up' }

export default function SignUpPage() {
  return (
    <AuthScreen>
      <SignUp routing="path" path="/sign-up" signInUrl={APP_SIGN_IN_URL} fallbackRedirectUrl={APP_AFTER_AUTH_URL} />
    </AuthScreen>
  )
}
