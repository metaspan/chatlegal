import { APP_DISCLOSURE_LABEL } from '@/lib/disclosure'

/**
 * Sticky app-shell footer. C-13 moved the "AI-generated information" label
 * here from the start of every reply (lib/disclosure.ts,
 * docs/policies/05-genai-disclosure.md).
 * The rest is the same product line as apps/site. Not legal advice.
 * C-16 (6 Nov 2026): the third footer line about the deferred second-language
 * product is removed — no such footer line is rendered (locked 3 Nov; see
 * docs/policies/04-bias-monitoring.md).
 * C-17 (12 Nov 2026): the disclaimer renders as ONE continuous line — the
 * disclosure label and the "Not a solicitor" line are a single paragraph, so
 * no forced break sits between "sources." and "Not a solicitor.". At desktop
 * widths it fits one line; on narrow screens it wraps at word boundaries.
 * No forced no-wrap, no trimming, and no hidden overflow anywhere, so it
 * can never overflow or clip at any width.
 */
export function DisclaimerBar() {
  return (
    <footer
      data-disclosure-footer
      className="z-30 shrink-0 border-t border-border bg-card px-4 py-1.5 text-center text-xs leading-snug text-muted-foreground"
    >
      <p data-disclosure-label>
        {APP_DISCLOSURE_LABEL} Not a solicitor. Not legal advice.
      </p>
    </footer>
  )
}
