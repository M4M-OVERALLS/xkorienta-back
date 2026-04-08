import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  reactCompiler: true,
  output: 'standalone',
  // En production derrière le reverse proxy, les assets sont servis
  // depuis /xkorienta/backend/_next/static/...
  ...(isProd && {
    assetPrefix: '/xkorienta/backend',
  }),
};

export default nextConfig;
