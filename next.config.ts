import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Temporarily disable ESLint during build for deployment
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Disable TypeScript errors during build for deployment
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // Optimize images
  images: {
    domains: [],
  },
  
  // Enable PWA-like features
  poweredByHeader: false,
};

export default nextConfig;
