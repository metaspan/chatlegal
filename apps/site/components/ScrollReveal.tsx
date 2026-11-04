'use client'

import { usePathname } from 'next/navigation'
import { useLayoutEffect, useState } from 'react'

/** Same elements as the view() rules in globals.css. */
const SCROLL_TARGETS = [
  '.home-points > li',
  '.home-source',
  '.home-waitlist',
  '.prose > :not(h1)',
  '.pager a',
].join(',')

function viewTimelineSupported(): boolean {
  return typeof CSS !== 'undefined' && CSS.supports('animation-timeline: view()')
}

/**
 * Scroll reveal for browsers without CSS view() timelines.
 * Where view() exists, globals.css owns the motion and this does nothing.
 */
export function ScrollReveal() {
  const pathname = usePathname()
  const [motionEpoch, setMotionEpoch] = useState(0)

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setMotionEpoch((value) => value + 1)
    reduce.addEventListener('change', onChange)
    return () => reduce.removeEventListener('change', onChange)
  }, [])

  useLayoutEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const root = document.documentElement
    if (reduce || viewTimelineSupported()) {
      root.removeAttribute('data-motion')
      return
    }

    root.setAttribute('data-motion', 'io')
    const nodes = Array.from(document.querySelectorAll<HTMLElement>(SCROLL_TARGETS))
    const pending: HTMLElement[] = []
    const seen = new Map<HTMLElement, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const el = entry.target as HTMLElement
          el.classList.remove('io-pending')
          el.classList.add('io-in')
          observer.unobserve(el)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )

    const viewBottom = window.innerHeight * 0.92
    for (const node of nodes) {
      if (node.getBoundingClientRect().top < viewBottom) {
        node.classList.add('io-target', 'io-in')
        continue
      }
      const parent = node.parentElement
      const index = parent ? (seen.get(parent) ?? 0) : 0
      if (parent) seen.set(parent, index + 1)
      node.style.transitionDelay = index > 0 ? `${Math.min(index, 3) * 45}ms` : ''
      node.classList.add('io-pending')
      pending.push(node)
    }

    if (pending.length > 0) void document.body.offsetWidth
    for (const node of pending) {
      node.classList.add('io-target')
      observer.observe(node)
    }

    return () => {
      observer.disconnect()
      root.removeAttribute('data-motion')
      for (const node of nodes) {
        node.classList.remove('io-target', 'io-pending', 'io-in')
        node.style.transitionDelay = ''
      }
    }
  }, [pathname, motionEpoch])

  return null
}
