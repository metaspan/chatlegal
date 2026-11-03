import { suggestEditHref } from '@/lib/suggest-edit'

export function SuggestEdit({ pathname }: { pathname: string }) {
  const href = suggestEditHref(pathname)
  if (!href) return null

  return (
    <p className="suggest-edit">
      <a href={href} target="_blank" rel="noopener noreferrer">
        Suggest a change to this page…
      </a>
    </p>
  )
}
