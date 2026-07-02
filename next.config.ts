import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin Turbopack root to this project (silences workspace-root warning)
  // when this app is checked out as part of a multi-package workspace.
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    // Phosphor: barrel z ~1500 modułami — bez tego dev kompiluje cały zestaw
    // per entry, a re-export poza ESM grozi wciągnięciem wszystkich ikon do bundla.
    optimizePackageImports: ["@phosphor-icons/react"],
  },
};

export default nextConfig;
