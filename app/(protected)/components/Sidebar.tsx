"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LayoutDashboard, Users, Wrench, ClipboardCheck, Bell, FolderOpen, AlertTriangle, Gauge } from "lucide-react";
import LogoutButton from "./LogoutButton";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, prefetch: false },
  { href: "/pendencias", label: "Pendências", icon: AlertTriangle, prefetch: false },
  { href: "/ifc", label: "Índice FireControl", icon: Gauge, prefetch: false },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/equipamentos", label: "Equipamentos", icon: Wrench },
  { href: "/inspecoes", label: "Inspeções", icon: ClipboardCheck },
  { href: "/documentos", label: "Documentos", icon: FolderOpen },
  { href: "/alertas", label: "Alertas", icon: Bell, prefetch: false },
];

function Brand() {
  return (
    <div className="px-5 py-6 border-b border-white/10">
      <p className="font-display text-2xl tracking-wide leading-none">
        FIRECONTROL <span className="text-brand-red">OS</span>
      </p>
      <p className="text-xs text-white/50 mt-1">Gestão interna</p>
    </div>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {nav.map((item) => {
        const active = pathname?.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            prefetch={item.prefetch ?? true}
            className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition ${
              active ? "bg-brand-red text-white" : "text-white/80 hover:bg-white/10 hover:text-white"
            }`}
          >
            <Icon size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Barra superior — só aparece no celular/tablet */}
      <div className="md:hidden flex items-center justify-between bg-brand-ink text-white px-4 py-3 sticky top-0 z-40">
        <p className="font-display text-xl tracking-wide leading-none">
          FIRECONTROL <span className="text-brand-red">OS</span>
        </p>
        <button onClick={() => setOpen(true)} aria-label="Abrir menu">
          <Menu size={24} />
        </button>
      </div>

      {/* Gaveta lateral — celular/tablet */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="w-64 bg-brand-ink text-white flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-6 border-b border-white/10">
              <p className="font-display text-2xl tracking-wide leading-none">
                FIRECONTROL <span className="text-brand-red">OS</span>
              </p>
              <button onClick={() => setOpen(false)} aria-label="Fechar menu">
                <X size={22} />
              </button>
            </div>
            <NavLinks onNavigate={() => setOpen(false)} />
            <div className="px-3 py-4 border-t border-white/10">
              <LogoutButton />
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setOpen(false)} />
        </div>
      )}

      {/* Sidebar fixa — desktop */}
      <aside className="hidden md:flex w-56 shrink-0 bg-brand-ink text-white flex-col">
        <Brand />
        <NavLinks />
        <div className="px-3 py-4 border-t border-white/10">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
