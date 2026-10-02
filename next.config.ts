import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Páginas dinâmicas já visitadas ficam 30 s no navegador: voltar/reabrir uma tela é instantâneo.
    // Server actions que gravam dados invalidam esse cache (revalidatePath/updateTag), então não fica dado velho após salvar.
    staleTimes: { dynamic: 30 },
  },
  images: {
    // Fotos dos festivais, no bucket público "festivais" do Supabase Storage
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/festivais/**" }],
  },
};

export default nextConfig;
