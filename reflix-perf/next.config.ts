import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    // Skip Next.js image optimization for external CDN URLs — TMDB's CDN is
    // already optimized and going through the Next.js image optimizer adds
    // latency for thousands of images.
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "image.tmdb.org",
      },
      {
        protocol: "https",
        hostname: "bqdzgnuanetryzdgxxaf.supabase.co",
      },
    ],
  },
};

export default nextConfig;
