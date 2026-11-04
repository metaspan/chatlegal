import type { NextConfig } from 'next'

/** Server app for app.chatlegal.uk. apps/site stays a static export. */
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Mastra and libSQL stay on the server. The client calls the matter, library, and move routes.
  serverExternalPackages: [
    '@mastra/core',
    '@mastra/memory',
    '@mastra/libsql',
    '@libsql/client',
    'libsql',
    'mammoth',
    'unpdf',
  ],
  experimental: {
    // The proxy buffers the body. A 10 MB file plus the multipart wrapper needs
    // more than the 10 MB default, or the route would store a cut-off file.
    // The upload route still refuses anything over 10 MB of file bytes.
    proxyClientMaxBodySize: '12mb',
  },
}

export default nextConfig
