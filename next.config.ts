import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Wired in P3 (i18n). Points at the request config next-intl reads per request.
const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    // Sample-data avatars and document previews (P4). No other remote hosts.
    remotePatterns: [
      { protocol: "https", hostname: "i.pravatar.cc" },
      { protocol: "https", hostname: "picsum.photos" },
    ],
  },
  experimental: {
    // Tree-shake the barrel imports of the heaviest icon/util packages.
    optimizePackageImports: ["lucide-react", "date-fns", "recharts", "radix-ui"],
  },
};

export default withNextIntl(nextConfig);
