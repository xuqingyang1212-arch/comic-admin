/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['192.168.73.100', '192.168.72.118', '10.0.0.29', '10.235.120.235'],
}

export default nextConfig
