/** ChatLegal mark, matching apps/site/app/icon.svg. Colours are the M1 chrome tokens. */
export function ChatLegalMark({ size = 28, tone = 'brand' }: { size?: number; tone?: 'brand' | 'on-chrome' }) {
  const fill = tone === 'on-chrome' ? 'var(--chrome-ink)' : 'var(--chrome)'
  const stroke = tone === 'on-chrome' ? 'var(--chrome)' : 'var(--chrome-ink)'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill={fill} />
      <path
        d="M9 8.5h10.5A3.5 3.5 0 0 1 23 12v11.5H12.5A3.5 3.5 0 0 1 9 20V8.5Z"
        stroke={stroke}
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M12 13h7M12 16.5h7M12 20h4" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
