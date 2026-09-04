import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The simulation engine keeps timers + subscriber sets in module scope, so it must
  // not be duplicated across the client bundle.
  serverExternalPackages: [],
};

export default nextConfig;
