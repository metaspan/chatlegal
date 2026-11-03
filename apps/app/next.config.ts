import type { NextConfig } from 'next'

/** Server app for app.chatlegal.uk. apps/site stays a static export. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Mastra and libSQL stay on the server. The client only calls /api/matters.
  serverExternalPackages: ['@mastra/core', '@mastra/memory', '@mastra/libsql', '@libsql/client', 'libsql'],
}

export default nextConfig
