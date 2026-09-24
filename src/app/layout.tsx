import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://sistema.saotomeexpresso.com"),
  title: { default: "São Tomé Expresso — Passagens de lancha", template: "%s · São Tomé Expresso" },
  description: "Compre passagens de lancha Manaus ↔ Santarém online. Itacoatiara, Parintins, Juruti e Óbidos.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${jakarta.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
