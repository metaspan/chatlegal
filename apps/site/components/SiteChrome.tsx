'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useState, type ReactNode } from 'react'
import { Disclaimer } from '@/components/Disclaimer'
import {
  flattenNav,
  navGroups,
  neighbours,
  normaliseHref,
  type NavItem,
} from '@/lib/nav'

export function SiteChrome({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark' | null>(null)
  const searchId = useId()
  const here = normaliseHref(pathname)
  const { prev, next } = neighbours(pathname)
  const needle = query.trim().toLowerCase()
  const results = needle
    ? flattenNav().filter((item) => `${item.title} ${item.summary}`.toLowerCase().includes(needle))
    : []

  useEffect(() => {
    setOpen(false)
    setQuery('')
  }, [pathname])

  useEffect(() => {
    setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
  }, [])

  function toggleTheme() {
    const nextTheme = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', nextTheme)
    try {
      localStorage.setItem('theme', nextTheme)
    } catch {
      /* private mode */
    }
    setTheme(nextTheme)
  }

  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <div className="sticky-top">
        <header className="mast">
          <button
            type="button"
            className="nav-toggle"
            aria-expanded={open}
            aria-controls="docs-nav"
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Close' : 'Pages'}
          </button>
          <Link href="/docs/" className="wordmark">
            <span className="wordmark-name">ChatLegal</span>
            <span className="wordmark-section">Docs</span>
          </Link>
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light mode' : theme === 'light' ? 'Dark mode' : 'Theme'}
          </button>
        </header>
      </div>
      <div className={open ? 'frame nav-open' : 'frame'}>
        <nav id="docs-nav" className="sidebar" aria-label="Docs">
          <form role="search" className="finder" onSubmit={(event) => event.preventDefault()}>
            <label htmlFor={searchId}>Find a page</label>
            <input
              id={searchId}
              type="search"
              value={query}
              autoComplete="off"
              placeholder="Deposit, welfare, sources"
              onChange={(event) => setQuery(event.target.value)}
            />
          </form>
          {needle ? (
            results.length > 0 ? (
              <ul className="nav-list">
                {results.map((item) => (
                  <li key={item.href}>
                    <ItemLink item={item} here={here} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="nav-empty">No matching page.</p>
            )
          ) : (
            navGroups.map((group) => (
              <div key={group.label} className="nav-group">
                <p className="nav-label">{group.label}</p>
                <ul className="nav-list">
                  {group.items.map((item) => (
                    <li key={item.href}>
                      <ItemLink item={item} here={here} />
                      {item.children && item.children.length > 0 ? (
                        <ul className="nav-children">
                          {item.children.map((child) => (
                            <li key={child.href}>
                              <ItemLink item={child} here={here} />
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </nav>
        <main id="content" tabIndex={-1} className="content">
          <article className="prose">{children}</article>
          <nav className="pager" aria-label="Adjacent pages">
            {prev ? (
              <Link href={prev.href} rel="prev">
                <span>Previous</span>
                {prev.title}
              </Link>
            ) : (
              <span />
            )}
            {next ? (
              <Link href={next.href} rel="next">
                <span>Next</span>
                {next.title}
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </main>
      </div>
      <Disclaimer />
    </div>
  )
}

function ItemLink({ item, here }: { item: NavItem; here: string }) {
  const current = normaliseHref(item.href) === here
  return (
    <span className="nav-row">
      <Link href={item.href} className="nav-link" aria-current={current ? 'page' : undefined}>
        {item.title}
      </Link>
      {item.status === 'planned' ? <span className="pill pill-planned">Planned</span> : null}
    </span>
  )
}
