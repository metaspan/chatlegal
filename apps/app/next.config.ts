import type { NextConfig } from 'next'

/** Server app for app.chatlegal.uk. apps/site stays a static export. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
}

export default nextConfig
