import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true, // Disable eslint blocking build
  },
  images: {
    unoptimized: true, // Disable default image optimization
  },
  assetPrefix: isProd ? '/altair_dashboard' : '',
  basePath: isProd ? '/altair_dashboard' : '',
  output: 'export',
};

export default nextConfig;

