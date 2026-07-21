import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FireControl OS",
  description: "Sistema interno de gestão de segurança contra incêndio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
