import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["unpdf", "pdf-parse", "pdfjs-dist"],
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
