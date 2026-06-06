import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Genera una carpeta .next/standalone con todo lo necesario para producción
  // (usada por el Dockerfile de producción)
  output: "standalone",

  // Permite llamar a la API desde el servidor sin salir del contenedor Docker
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.INTERNAL_API_URL ?? "http://backend:3001"}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
