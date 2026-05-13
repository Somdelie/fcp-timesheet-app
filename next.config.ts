import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdf-parse v2 uses pdfjs-dist which spawns a dynamic worker via require().
  // Turbopack cannot statically analyse those requires, so both packages must
  // be excluded from the bundle and resolved natively by Node.js at runtime.
  serverExternalPackages: ["pdf-parse", "pdfjs-dist"],
};

export default nextConfig;
