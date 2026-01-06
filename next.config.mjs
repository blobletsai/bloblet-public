/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Enable prod sourcemaps to debug preview/prod crashes
  productionBrowserSourceMaps: true,
  // Speed up quick iteration builds when FAST_BUILD=true
  eslint: {
    ignoreDuringBuilds: process.env.FAST_BUILD === 'true',
  },
  typescript: {
    ignoreBuildErrors: process.env.FAST_BUILD === 'true',
  },
  transpilePackages: [
    '@solana/wallet-adapter-react',
    '@solana/wallet-adapter-react-ui',
    '@solana/wallet-adapter-wallets',
  ],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.r2.dev',
        pathname: '/sprites/**',
      },
    ],
  },
  webpack: (config, { isServer }) => {
    // Fix for module resolution issues
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };

    // Ignore optional dependencies that cause issues
    config.externals.push({
      'utf-8-validate': 'commonjs utf-8-validate',
      'bufferutil': 'commonjs bufferutil',
    });

    return config;
  },
};

export default nextConfig;
