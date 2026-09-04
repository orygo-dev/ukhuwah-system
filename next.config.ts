import type { NextConfig } from "next";

function mediaRemotePatterns() {
  const patterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [
    {
      protocol: "https",
      hostname: "api.dicebear.com",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "**.r2.dev",
      pathname: "/**",
    },
  ];

  const mediaHost = (
    process.env.NEXT_PUBLIC_MEDIA_HOST ||
    process.env.R2_PUBLIC_HOST ||
    ""
  )
    .trim()
    .replace(/^https?:\/\//i, "")
    .split("/")[0];

  if (mediaHost) {
    patterns.push({
      protocol: "https",
      hostname: mediaHost,
      pathname: "/**",
    });
  }

  return patterns;
}

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  poweredByHeader: false,
  images: {
    remotePatterns: mediaRemotePatterns(),
  },
  async rewrites() {
    return [
      {
        source: "/uploads/notifications/:path*",
        destination: "/api/media/notifications/:path*",
      },
      {
        source: "/uploads/reading/:path*",
        destination: "/api/media/reading/:path*",
      },
      {
        source: "/uploads/avatars/:path*",
        destination: "/api/media/avatars/:path*",
      },
    ];
  },
  async headers() {
    const securityHeaders = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(self), microphone=(self), geolocation=()",
      },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
      ...(process.env.NODE_ENV === "production"
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=31536000; includeSubDomains",
            },
          ]
        : []),
    ];

    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/app-ads.txt",
        headers: [
          { key: "Content-Type", value: "text/plain; charset=utf-8" },
          { key: "Cache-Control", value: "public, max-age=3600, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
