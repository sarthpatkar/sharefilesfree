import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // Pin the workspace root so Turbopack doesn't get confused by an
    // unrelated package-lock.json sitting in the parent (home) directory.
    root: __dirname,
  },
};

export default nextConfig;
