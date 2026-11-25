const impulsOrigin = "https://impulssport.md";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: false,
  },
  async rewrites() {
    // Use the Impuls app for both the class pages and their supporting assets.
    const sharedRoutes = [
      "/classes",
      "/classes/:path+",
      "/cont",
      "/check-in",
      "/login",
      "/auth/callback",
      "/auth/confirm",
      "/reset-password",
      "/api/auth/setup",
      "/api/me",
      "/api/dashboard",
      "/_next/static/:path*",
      "/_next/image",
      "/class-media/:path*",
      "/impulsnewlogo.png",
      "/tab-logo.png",
      "/qr-scanner-worker.min.js",
    ];
    const existingKioskRoutes = ["/api/kiosk/version", "/api/kiosk/device", "/api/scan"];

    return {
      beforeFiles: [
        ...sharedRoutes.map((source) => ({ source, destination: impulsOrigin + source })),
        ...existingKioskRoutes.map((source) => ({ source, destination: `${impulsOrigin}/classes${source}` })),
      ],
    };
  },
};

export default nextConfig;
