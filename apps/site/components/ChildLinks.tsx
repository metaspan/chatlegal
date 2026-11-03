import Link from 'next/link'
import { findItem, statusLabel } from '@/lib/nav'

export function ChildLinks({ href }: { href: string }) {
  const page = findItem(href)
  const children = page?.children ?? []
  if (children.length === 0) return null

  return (
    <ul className="child-links">
      {children.map((child) => (
        <li key={child.href}>
          <Link href={child.href}>{child.title}</Link>
          <span className={child.status === 'planned' ? 'pill pill-planned' : 'pill'}>
            {statusLabel(child.status)}
          </span>
        </li>
      ))}
    </ul>
  )
}
