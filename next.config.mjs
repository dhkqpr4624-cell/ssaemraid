/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: [
    '3000-ih1uhjcbhhq26ocqvmkfw-ff309969.sg1.manus.computer',
    '*.sg1.manus.computer',
  ],
}

export default nextConfig
