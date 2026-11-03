import Link from 'next/link'
import { navGroups, normaliseHref } from '@/lib/nav'

export function TopLinks() {
  return (
    <div className="top-links">
      {navGroups.map((group) => {
        const items = group.items.filter((item) => normaliseHref(item.href) !== '/docs/')
        if (items.length === 0) return null
        return (
          <section key={group.label}>
            <h3>{group.label}</h3>
            <ul>
              {items.map((item) => (
                <li key={item.href}>
                  <Link href={item.href}>{item.title}</Link>
                </li>
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
