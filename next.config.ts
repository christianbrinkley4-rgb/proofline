import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite loads its WebAssembly build from its own package folder, so it must not be bundled.
  serverExternalPackages: ["@electric-sql/pglite"],
  redirects() {
    // The page is called Applications, so people type that address. Its route is /app/tracker.
    return [{ source: "/app/applications", destination: "/app/tracker", permanent: false }];
  },
};

export default nextConfig;
