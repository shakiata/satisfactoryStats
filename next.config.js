/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: "out",
  images: {
    unoptimized: true,
  },
  // Use relative asset paths so the static export works under Electron's file:// protocol
  assetPrefix: "./",
};

module.exports = nextConfig;
