import type { NextConfig } from "next";

const apiOrigin = process.env.RLR_API_ORIGIN || "http://127.0.0.1:8741";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  devIndicators: false,
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return {
      fallback: [
        { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      ],
    };
  },
};

export default nextConfig;
