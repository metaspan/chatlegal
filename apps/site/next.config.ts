import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

/** Static HTML in `out/` for nginx. Production does not run a Node server. */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
}

const withMDX = createMDX({
  extension: /\.(md|mdx)$/,
})

export default withMDX(nextConfig)
