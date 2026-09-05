import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Where the build output goes. Normally .next, but a deploy overrides it so
  // the new build lands somewhere else entirely and the running server keeps
  // serving the old one untouched. Building in place overwrote .next while the
  // live process was still reading from it, which for the length of a build
  // meant requests for chunks that had just been deleted. The deploy script
  // swaps the finished directory into place with a rename instead.
  distDir: process.env.NEXT_DIST_DIR || ".next",

  turbopack: {
    // Pin the workspace root so Turbopack doesn't get confused by an
    // unrelated package-lock.json sitting in the parent (home) directory.
    root: __dirname,
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Stops the browser from guessing content types (e.g. treating an
          // uploaded file as executable HTML/JS if a mime type is wrong).
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No third-party site should be able to iframe this app (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          // Don't leak the full URL (which can contain a shared-link token) to
          // external sites when a user clicks an outbound link from this app.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // We don't use any of these browser features; explicitly disabling
          // them costs nothing and shrinks the attack surface a little.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          // NOTE: no Content-Security-Policy yet. This needs care before adding —
          // the P2P path opens a cross-origin WebSocket to the signaling server
          // (NEXT_PUBLIC_SIGNALING_URL) and WebRTC ICE/TURN traffic to
          // Cloudflare's relay, both of which a naive `connect-src 'self'` would
          // likely break. Worth doing once there's a live deployment to test
          // against, rather than shipping an untested CSP that silently breaks
          // the core transfer feature.
        ],
      },
    ];
  },
};

export default nextConfig;
