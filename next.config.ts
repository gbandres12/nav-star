import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Fotos dos festivais, no bucket público "festivais" do Supabase Storage
    remotePatterns: [{ protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/festivais/**" }],
  },
};

export default nextConfig;
