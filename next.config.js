/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['arweave.net', 'www.arweave.net', 'via.placeholder.com'],
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}

module.exports = nextConfig

