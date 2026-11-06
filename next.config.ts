import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root to this project so Next.js ignores
    // unrelated lockfiles found higher up in the filesystem.
    root: __dirname,
  },
};

export default nextConfig;
