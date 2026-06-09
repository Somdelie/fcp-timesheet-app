import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // pdf-parse v2 spawns a dynamic worker via require(), so keep it resolved
  // natively by Node.js at runtime. Do not externalize pdfjs-dist here: the app
  // also imports pdfjs-dist/legacy/build/pdf on the client, and Next needs to
  // bundle that subpath for production/serverless builds.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
