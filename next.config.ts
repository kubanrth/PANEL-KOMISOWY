import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // We're inside a multi-package workspace; pin Turbopack root explicitly.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
