/** Same product line as apps/site. Not legal advice, and not a Welsh legal text. */
export function DisclaimerBar() {
  return (
    <footer className="z-30 shrink-0 border-t border-border bg-card px-4 py-1.5 text-center text-xs leading-snug text-muted-foreground">
      <p>Not a solicitor. Not legal advice.</p>
      <p>
        <span lang="cy">Cymraeg</span>: official sources may be available in Welsh — we do not yet
        offer a full Welsh product.
      </p>
    </footer>
  )
}
