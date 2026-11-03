/** ChatLegal mark, matching apps/site/app/icon.svg. */
export function ChatLegalMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="7" fill="#6E2430" />
      <path
        d="M9 8.5h10.5A3.5 3.5 0 0 1 23 12v11.5H12.5A3.5 3.5 0 0 1 9 20V8.5Z"
        stroke="#FFF7F4"
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M12 13h7M12 16.5h7M12 20h4" stroke="#FFF7F4" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
