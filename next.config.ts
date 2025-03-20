import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.externals = [...(config.externals || []), "pm2"];
    return config;
  },
};

export default nextConfig;
