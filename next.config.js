/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['res.cloudinary.com'],
  },
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material']
  },
}
module.exports = nextConfig;
