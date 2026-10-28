/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Unsplash images in next/image (used by existing prop images)
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  devIndicators: false,
  async rewrites() {
    const rewrites = [
      { source: "/inventory", destination: "/admin/inventory" },
      { source: "/props", destination: "/admin/props" },
      { source: "/categories", destination: "/admin/categories" },
      { source: "/customers", destination: "/admin/customers" },
      { source: "/calendar", destination: "/admin/calendar" },
      { source: "/analytics", destination: "/admin/analytics" },
      { source: "/settings", destination: "/admin/settings" },
      { source: "/enquiries", destination: "/admin/enquiries" },
      { source: "/rental-requests", destination: "/admin/rental-requests" },
    ];

    if (process.env.NEXT_PUBLIC_APP_MODE === "admin") {
      rewrites.unshift({
        source: "/",
        destination: "/admin",
      });
    }

    return rewrites;
  },
};

export default nextConfig;
