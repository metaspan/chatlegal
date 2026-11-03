import { ChatLegalMark } from '@/components/mark'
import { DisclaimerBar } from '@/components/disclaimer-bar'

export function AuthScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground">
      <header className="flex h-14 items-center gap-3 bg-primary px-5 text-primary-foreground">
        <ChatLegalMark size={28} />
        <span className="font-serif text-xl font-semibold tracking-tight">ChatLegal</span>
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <p className="text-center text-sm text-muted-foreground">Sign in to your personal account.</p>
          {children}
        </div>
      </main>
      <DisclaimerBar />
    </div>
  )
}
