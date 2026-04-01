/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/prototype-for-wrong-invoice',
  assetPrefix: '/prototype-for-wrong-invoice',
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1',
  },
}

module.exports = nextConfig
