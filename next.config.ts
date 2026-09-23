import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly build from its own package folder, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
