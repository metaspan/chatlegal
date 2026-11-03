export type PageStatus = 'draft' | 'planned' | 'eval:locked'

export type NavItem = {
  title: string
  href: string
  status: PageStatus
  /** One line for search and llms.txt. Page prose lives in `app/docs`. */
  summary: string
  children?: NavItem[]
}

export type NavGroup = {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        title: 'Overview',
        href: '/docs/',
        status: 'draft',
        summary:
          'Start here. Five evaluation pages are draft information. The other pages are still placeholders. Not legal advice.',
      },
      {
        title: 'How it works',
        href: '/docs/how-it-works/',
        status: 'draft',
        summary:
          'Placeholder for protocols, triage, citations, and jurisdiction tags for England and Wales, Scotland, and Northern Ireland.',
      },
    ],
  },
  {
    label: 'Law',
    items: [
      {
        title: 'Housing',
        href: '/docs/housing/',
        status: 'draft',
        summary:
          'Draft hub for housing in England and Wales. Possession notices and deposits are in the evaluation set. Not legal advice.',
        children: [
          {
            title: 'Possession notice',
            href: '/docs/housing/possession-notice/',
            status: 'eval:locked',
            summary:
              'Draft information on possession notices in England after 1 May 2026. Not a verdict on any notice.',
          },
          {
            title: 'Deposit',
            href: '/docs/housing/deposit/',
            status: 'eval:locked',
            summary:
              'Draft information on tenancy deposit protection in England. No award is calculated.',
          },
          {
            title: 'Disrepair',
            href: '/docs/housing/disrepair/',
            status: 'planned',
            summary: 'Planned stub for housing disrepair. Not written yet.',
          },
          {
            title: 'Rent increase',
            href: '/docs/housing/rent-increase/',
            status: 'planned',
            summary: 'Planned stub for rent increases. Not written yet.',
          },
          {
            title: 'Illegal eviction',
            href: '/docs/housing/illegal-eviction/',
            status: 'planned',
            summary:
              'Planned stub. Illegal eviction is marked for a hard-escalate callout. This page does not explain the law.',
          },
          {
            title: 'Neighbour nuisance',
            href: '/docs/housing/neighbour-nuisance/',
            status: 'planned',
            summary: 'Planned stub for neighbour nuisance. Not written yet.',
          },
          {
            title: 'Boundary',
            href: '/docs/housing/boundary/',
            status: 'planned',
            summary: 'Planned stub for boundary problems. Not written yet.',
          },
        ],
      },
      {
        title: 'Employment',
        href: '/docs/employment/',
        status: 'draft',
        summary:
          'Draft hub for employment in England and Wales. Unpaid wages are in the evaluation set. Not legal advice.',
        children: [
          {
            title: 'Unpaid wages',
            href: '/docs/employment/unpaid-wages/',
            status: 'eval:locked',
            summary:
              'Draft information on unpaid wages and the Acas clock. No deadline is calculated.',
          },
          {
            title: 'Dismissal',
            href: '/docs/employment/dismissal/',
            status: 'planned',
            summary: 'Planned stub for dismissal. Not written yet.',
          },
          {
            title: 'Redundancy',
            href: '/docs/employment/redundancy/',
            status: 'planned',
            summary: 'Planned stub for redundancy. Not written yet.',
          },
          {
            title: 'Harassment and discrimination',
            href: '/docs/employment/harassment-discrimination/',
            status: 'planned',
            summary: 'Planned stub for harassment and discrimination at work. Not written yet.',
          },
          {
            title: 'Holiday and sick pay',
            href: '/docs/employment/holiday-sick-pay/',
            status: 'planned',
            summary: 'Planned stub for holiday and sick pay. Not written yet.',
          },
        ],
      },
      {
        title: 'Consumer / debt',
        href: '/docs/consumer/',
        status: 'draft',
        summary:
          'Draft hub for consumer and debt topics in England and Wales. Private parking is in the evaluation set.',
        children: [
          {
            title: 'Private parking',
            href: '/docs/consumer/private-parking/',
            status: 'eval:locked',
            summary:
              'Draft information on private parking charges in England and Wales. Not a decision on whether to pay.',
          },
          {
            title: 'Council PCN',
            href: '/docs/consumer/council-pcn/',
            status: 'planned',
            summary: 'Planned stub for council PCNs. Not written yet.',
          },
          {
            title: 'Faulty goods',
            href: '/docs/consumer/faulty-goods/',
            status: 'planned',
            summary: 'Planned stub for faulty goods. Not written yet.',
          },
          {
            title: 'Bailiffs',
            href: '/docs/consumer/bailiffs/',
            status: 'planned',
            summary: 'Planned stub for bailiffs. Not written yet.',
          },
          {
            title: 'Credit complaints',
            href: '/docs/consumer/credit-complaints/',
            status: 'planned',
            summary: 'Planned stub for credit complaints. Not written yet.',
          },
        ],
      },
      {
        title: 'Welfare',
        href: '/docs/welfare/',
        status: 'draft',
        summary:
          'Draft hub for welfare in England. Universal Credit sanctions are in the evaluation set. Not legal advice.',
        children: [
          {
            title: 'Universal Credit sanction',
            href: '/docs/welfare/uc-sanction-mr/',
            status: 'eval:locked',
            summary:
              'Draft information on Universal Credit sanctions and mandatory reconsideration. No outcome is predicted.',
          },
          {
            title: 'PIP refusal',
            href: '/docs/welfare/pip-refusal/',
            status: 'planned',
            summary: 'Planned stub for PIP refusals. Not written yet.',
          },
          {
            title: 'Tribunal appeal',
            href: '/docs/welfare/tribunal-appeal/',
            status: 'planned',
            summary: 'Planned stub for benefit tribunal appeals. Not written yet.',
          },
          {
            title: 'Overpayment',
            href: '/docs/welfare/overpayment/',
            status: 'planned',
            summary: 'Planned stub for benefit overpayments. Not written yet.',
          },
        ],
      },
    ],
  },
  {
    label: 'Sources',
    items: [
      {
        title: 'Sources',
        href: '/docs/sources/',
        status: 'draft',
        summary:
          'Placeholder hub for data sources. Allowlist tables are not generated in this milestone.',
        children: [
          {
            title: 'Legislation',
            href: '/docs/sources/legislation/',
            status: 'draft',
            summary:
              'Placeholder for legislation.gov.uk and related Open Government Licence text. No statute is quoted here.',
          },
          {
            title: 'GOV.UK and Acas',
            href: '/docs/sources/govuk-acas/',
            status: 'draft',
            summary:
              'Placeholder for GOV.UK, Acas, and related official guidance sources. No guidance is quoted here.',
          },
          {
            title: 'Find Case Law',
            href: '/docs/sources/find-case-law/',
            status: 'draft',
            summary: 'Placeholder for Find Case Law licence notes. Judgment text is not shown.',
          },
          {
            title: 'Courts and tribunals',
            href: '/docs/sources/courts-tribunals/',
            status: 'draft',
            summary:
              'Placeholder for court and tribunal source notes. Decisions are not reproduced here.',
          },
          {
            title: 'Link-out only',
            href: '/docs/sources/link-out-only/',
            status: 'draft',
            summary:
              'Placeholder for sources that stay link-out only. This site does not link to the Official Injury Claim service and does not quote blocked sources.',
          },
          {
            title: 'Attribution',
            href: '/docs/sources/attribution/',
            status: 'draft',
            summary:
              'Placeholder for the attribution lines the site will use when it later quotes official text. Nothing is quoted in this scaffold.',
          },
        ],
      },
    ],
  },
  {
    label: 'Help',
    items: [
      {
        title: 'Referrals',
        href: '/docs/referrals/',
        status: 'draft',
        summary:
          'Placeholder for where to get help from a person. Routes are not listed yet. This page is not a helpline.',
      },
    ],
  },
  {
    label: 'Governance',
    items: [
      {
        title: 'Policies',
        href: '/docs/policies/',
        status: 'draft',
        summary:
          'Placeholder index of draft policy notes in the ChatLegal repository. Summaries are not written yet.',
      },
      {
        title: 'For agents',
        href: '/docs/for-agents/',
        status: 'draft',
        summary: 'Machine-readable stub index at /llms.txt. Citation rules are not written yet.',
      },
    ],
  },
]

export function normaliseHref(href: string): string {
  if (!href) return '/'
  const withSlash = href.endsWith('/') ? href : `${href}/`
  return withSlash.length > 1 && withSlash !== '/' ? withSlash : withSlash
}

export function flattenNav(groups: NavGroup[] = navGroups): NavItem[] {
  const pages: NavItem[] = []
  for (const group of groups) {
    for (const item of group.items) {
      pages.push(item)
      if (item.children) pages.push(...item.children)
    }
  }
  return pages
}

export function findItem(href: string): NavItem | undefined {
  const key = normaliseHref(href)
  return flattenNav().find((item) => normaliseHref(item.href) === key)
}

export function statusLabel(status: PageStatus): 'Draft' | 'Planned' | 'Eval locked' {
  if (status === 'planned') return 'Planned'
  if (status === 'eval:locked') return 'Eval locked'
  return 'Draft'
}

export function neighbours(href: string): { prev?: NavItem; next?: NavItem } {
  const pages = flattenNav()
  const key = normaliseHref(href)
  const index = pages.findIndex((item) => normaliseHref(item.href) === key)
  if (index < 0) return {}
  return {
    prev: index > 0 ? pages[index - 1] : undefined,
    next: index < pages.length - 1 ? pages[index + 1] : undefined,
  }
}

export function renderLlmsTxt(): string {
  const lines = [
    '# ChatLegal docs',
    '',
    '> UK citizen legal-information pages for chatlegal.uk. Not a solicitor. Not legal advice.',
    '',
    'Five evaluation leaves are draft copy from the gold notes. They are not counsel-reviewed. Other pages are still placeholders.',
    '',
    'Source: https://github.com/metaspan/chatlegal',
    '',
  ]

  for (const group of navGroups) {
    lines.push(`## ${group.label}`, '')
    for (const item of group.items) {
      lines.push(linkLine(item))
      for (const child of item.children ?? []) lines.push(linkLine(child))
    }
    lines.push('')
  }

  return `${lines.join('\n').trimEnd()}\n`
}

function linkLine(item: NavItem): string {
  return `- [${item.title}](https://chatlegal.uk${item.href}): ${item.summary}`
}
