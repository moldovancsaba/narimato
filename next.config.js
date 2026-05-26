/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    '@doneisbetter/gds-theme',
    '@doneisbetter/gds-core',
    '@doneisbetter/gds-admin',
  ],
  webpack: (config) => {
    // Prefer Narimato's node_modules for GDS peer deps (@mantine/*, @tabler/icons-react).
    config.resolve.symlinks = false;

    const root = __dirname;
    config.resolve.alias = {
      ...config.resolve.alias,
      '@mantine/core': path.join(root, 'node_modules/@mantine/core'),
      '@mantine/hooks': path.join(root, 'node_modules/@mantine/hooks'),
      '@mantine/modals': path.join(root, 'node_modules/@mantine/modals'),
      '@mantine/notifications': path.join(root, 'node_modules/@mantine/notifications'),
      '@tabler/icons-react': path.join(root, 'node_modules/@tabler/icons-react'),
    };
    return config;
  },
};

module.exports = nextConfig;
