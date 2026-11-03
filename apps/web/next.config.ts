import type { NextConfig } from "next";

// Env comes from the repository-root .env, loaded by the npm scripts via `node --env-file-if-exists`
// (next start does not re-run this file, so loading env here would not reach the runtime).

const isDev = process.env.NODE_ENV !== "production";

// ASI05 / 9.4.3: no inline HTML from data, strict CSP, same-origin only.
const csp = [
  "default-src 'self'",
  // 'wasm-unsafe-eval': on-device face detection (MediaPipe WASM, same-origin); does not allow JS eval.
  `script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://images.metmuseum.org",
  "font-src 'self'",
  "connect-src 'self'",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const nextConfig: NextConfig = {
  // a second build directory lets a work build run beside the one being reviewed (NEXT_DIST_DIR=.next-work)
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  cacheComponents: true,
  partialPrefetching: true,
  transpilePackages: ["@tsumugi/core"],
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
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
