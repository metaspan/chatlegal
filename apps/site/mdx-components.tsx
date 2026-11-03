import type { MDXComponents } from 'mdx/types'
import { isValidElement, type ComponentProps, type ReactNode } from 'react'
import Link from 'next/link'
import { Callout } from '@/components/Callout'
import { ChildLinks } from '@/components/ChildLinks'
import { StatusNote } from '@/components/StatusNote'
import { TopLinks } from '@/components/TopLinks'

function textOf(node: ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children)
  return ''
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function Heading({ as: Tag, children }: { as: 'h1' | 'h2' | 'h3'; children?: ReactNode }) {
  const id = slugify(textOf(children))
  if (!id) return <Tag>{children}</Tag>
  return (
    <Tag id={id}>
      <a href={`#${id}`}>{children}</a>
    </Tag>
  )
}

function MarkdownLink({ href = '', children, ...rest }: ComponentProps<'a'>) {
  if (href.startsWith('/')) {
    return <Link href={href}>{children}</Link>
  }
  const external = href.startsWith('http://') || href.startsWith('https://')
  return (
    <a href={href} {...rest} rel={external ? 'noreferrer' : rest.rel}>
      {children}
    </a>
  )
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    ...components,
    a: MarkdownLink,
    h1: ({ children }) => <Heading as="h1">{children}</Heading>,
    h2: ({ children }) => <Heading as="h2">{children}</Heading>,
    h3: ({ children }) => <Heading as="h3">{children}</Heading>,
    Callout,
    ChildLinks,
    StatusNote,
    TopLinks,
  }
}
