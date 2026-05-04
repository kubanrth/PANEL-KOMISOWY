import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this project (silences workspace-root warning)
  // when this app is checked out as part of a multi-package workspace.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
