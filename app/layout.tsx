import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "FireControl OS",
  description: "Sistema interno de gestão de segurança contra incêndio",
};

const nav = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/clientes", label: "Clientes" },
  { href: "/equipamentos", label: "Equipamentos" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <div className="flex min-h-screen">
          <aside className="w-56 shrink-0 bg-brand-ink text-white flex flex-col">
            <div className="px-5 py-6 border-b border-white/10">
              <p className="font-display text-2xl tracking-wide leading-none">
                FIRECONTROL <span className="text-brand-red">OS</span>
              </p>
              <p className="text-xs text-white/50 mt-1">Gestão interna</p>
            </div>
            <nav className="flex-1 px-3 py-4 space-y-1">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block rounded-md px-3 py-2 text-sm text-white/80 hover:bg-white/10 hover:text-white transition"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </aside>
          <main className="flex-1 p-8">{children}</main>
        </div>
      </body>
    </html>
  );
}
