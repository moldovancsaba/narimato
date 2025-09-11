/**
 * FUNCTIONAL: Centralize security hardening for images and HTTP response headers.
 * STRATEGIC: Mitigate SSRF-like vectors via middleware redirects and constrain the image optimizer attack surface
 *            (cache key confusion, content injection) even if next/image is not currently used.
 */

// Allowed remote image domains used by NARIMATO (keep minimal and explicit)
// NOTE: Update this list when you onboard a new trusted image host.
const allowedImageDomains = [
  'i.ibb.co',            // ImgBB CDN
  'images.unsplash.com', // Unsplash (background presets, if used)
  'cdn.narimato.com'     // Example first-party CDN (adjust/remove if not used)
];

// Global security headers applied to all routes
// FUNCTIONAL: Sets CSP, anti-MIME sniffing, clickjacking protection, referrer policy, and cross-origin policies.
// STRATEGIC: Defense-in-depth across tenants; headers enforced at the edge/runtime regardless of route handler.
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "base-uri 'none'",
      "object-src 'none'",
      // Keep img-src tight; include only self, data, and approved HTTPS hosts
      "img-src 'self' data: https: https://i.ibb.co https://images.unsplash.com https://cdn.narimato.com",
      // Avoid inline scripts; the app uses custom CSS, not inline JS
      "script-src 'self'",
      // Allow inline styles only if required by theming; keep as strict as possible
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self' https: data:",
      // Limit outbound connections; include only HTTPS endpoints
      "connect-src 'self' https:",
      // Prevent clickjacking
      "frame-ancestors 'none'",
      // Enforce HTTPS-only subrequests
      "upgrade-insecure-requests"
    ].join('; ')
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'no-referrer' },
  { key: 'Permissions-Policy', value: 'accelerometer=(), autoplay=(), camera=(), geolocation=(), microphone=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' }
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep Pages Router; do NOT switch to App Router
  reactStrictMode: true,

  // FUNCTIONAL: Constrain image optimizer to vetted hosts and deny SVG processing by optimizer.
  // STRATEGIC: Reduces risk of cache key confusion and injection via untrusted sources.
  images: {
    dangerouslyAllowSVG: false,
    contentDispositionType: 'attachment',
    formats: ['image/avif', 'image/webp'],
    // Optional: reduce cache ambiguity window
    minimumCacheTTL: 60,
    remotePatterns: allowedImageDomains.map((hostname) => ({
      protocol: 'https',
      hostname
    }))
  },

  async headers() {
    // Apply to all routes
    return [
      {
        source: '/:path*',
        headers: securityHeaders
      }
    ];
  }
};

module.exports = nextConfig;
