/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Empaqueta el server y solo las dependencias usadas: la imagen de
  // producción no necesita node_modules completo.
  output: 'standalone',
  env: {
    NEXT_PUBLIC_API_URL:
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
  },
}

module.exports = nextConfig
