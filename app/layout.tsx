import type { Metadata } from "next";
import BfcacheGuard from "./components/BfcacheGuard";
import "./globals.css";

export const metadata: Metadata = {
  title: "FireControl OS",
  description: "Sistema interno de gestão de segurança contra incêndio",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <BfcacheGuard />
        {children}
      </body>
    </html>
  );
}
