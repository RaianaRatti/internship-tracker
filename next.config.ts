import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
