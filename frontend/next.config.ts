import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  allowedDevOrigins: ["192.168.123.88"],

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost/api/:path*",
      },
    ];
  },
};

export default nextConfig;