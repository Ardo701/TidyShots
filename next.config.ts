import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

/*
 * The page may only talk to its own origin: photos are opened as blob: URLs
 * and nothing can be sent to a third party, even by mistake. Next.js inlines
 * its bootstrap scripts, hence 'unsafe-inline'; dev mode also needs eval and
 * the hot-reload websocket.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Private tool: never indexed, on any route or file type. There is
          // deliberately no robots.txt Disallow, so crawlers can read this.
          { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive, nosnippet, noimageindex" },
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
