/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['res.cloudinary.com', 'i.ibb.co'],
  },
  experimental: {
    serverActions: true,
  },
}
module.exports = nextConfig;
