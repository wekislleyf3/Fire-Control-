"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Menu,
  X,
  LayoutDashboard,
  Users,
  Wrench,
  ClipboardCheck,
  Bell,
  FolderOpen,
  AlertTriangle,
  Gauge,
  QrCode,
  ShieldCheck,
  Radio,
  CalendarDays,
  Kanban,
  Inbox,
  ChevronDown,
  BookOpenCheck,
  FileSignature,
} from "lucide-react";
import LogoutButton from "./LogoutButton";

type NavItem = {
  href: string;
  label: string;
  icon: typeof Radio;
  prefetch?: boolean;
};

/** Sempre visível, fora de qualquer setor — é a tela inicial do sistema. */
const ITEM_PRINCIPAL: NavItem = { href: "/operacao", label: "Operação", icon: Radio, prefetch: false };

/** Abas agrupadas por setor, pra não ficar tudo solto numa lista só. */
const SETORES: { titulo: string; itens: NavItem[] }[] = [
  {
    titulo: "Comercial",
    itens: [
      { href: "/leads", label: "Leads do site", icon: Inbox, prefetch: false },
      { href: "/pipeline", label: "Pipeline", icon: Kanban, prefetch: false },
      { href: "/clientes", label: "Clientes", icon: Users },
    ],
  },
  {
    titulo: "Operacional",
    itens: [
      { href: "/agenda", label: "Agenda", icon: CalendarDays, prefetch: false },
      { href: "/equipamentos", label: "Equipamentos", icon: Wrench },
      { href: "/inspecoes", label: "Inspeções", icon: ClipboardCheck },
      { href: "/ordens-servico", label: "Ordens de Serviço", icon: FileSignature, prefetch: false },
      { href: "/documentos", label: "Documentos", icon: FolderOpen },
      { href: "/metodo-fire", label: "Método Fire", icon: BookOpenCheck, prefetch: false },
    ],
  },
  {
    titulo: "Indicadores",
    itens: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, prefetch: false },
      { href: "/ifc", label: "Índice FireControl", icon: Gauge, prefetch: false },
      { href: "/pendencias", label: "Pendências", icon: AlertTriangle, prefetch: false },
      { href: "/alertas", label: "Alertas", icon: Bell, prefetch: false },
    ],
  },
  {
    titulo: "Segurança",
    itens: [
      { href: "/documentos-emitidos", label: "Documentos emitidos", icon: ShieldCheck, prefetch: false },
      { href: "/scanner", label: "Escanear QR", icon: QrCode, prefetch: false },
    ],
  },
];

function Brand() {
  return (
    <div className="px-5 py-7 border-b border-white/10">
      <p className="font-display text-[26px] tracking-wide leading-none">
        FIRECONTROL <span className="text-brand-red">OS</span>
      </p>
      <p className="text-xs text-white/60 mt-1.5">Gestão interna</p>
    </div>
  );
}

function ItemLink({ item, ativo, onNavigate }: { item: NavItem; ativo: boolean; onNavigate?: () => void }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      prefetch={item.prefetch ?? true}
      className={`flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-semibold transition ${
        ativo ? "bg-brand-red text-white" : "text-white hover:bg-white/10"
      }`}
    >
      <Icon size={24} className={ativo ? "text-white" : "text-white/90"} />
      {item.label}
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function estaAtivo(href: string) {
    return pathname?.startsWith(href) ?? false;
  }

  // Setor com a página atual dentro dele começa aberto; os outros começam
  // fechados, pra não virar uma lista gigante de novo.
  const [colapsados, setColapsados] = useState<Record<string, boolean>>(() => {
    const estado: Record<string, boolean> = {};
    for (const setor of SETORES) {
      const temAtivo = setor.itens.some((i) => estaAtivo(i.href));
      estado[setor.titulo] = !temAtivo;
    }
    return estado;
  });

  function toggleSetor(titulo: string) {
    setColapsados((c) => ({ ...c, [titulo]: !c[titulo] }));
  }

  return (
    <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
      <ItemLink item={ITEM_PRINCIPAL} ativo={estaAtivo(ITEM_PRINCIPAL.href)} onNavigate={onNavigate} />

      {SETORES.map((setor) => {
        const colapsado = colapsados[setor.titulo] ?? false;
        return (
          <div key={setor.titulo} className="pt-3">
            <button
              onClick={() => toggleSetor(setor.titulo)}
              className="w-full flex items-center justify-between px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white/55 hover:text-white transition"
            >
              {setor.titulo}
              <ChevronDown size={14} className={`transition-transform ${colapsado ? "-rotate-90" : ""}`} />
            </button>
            {!colapsado && (
              <div className="space-y-1.5 mt-1.5">
                {setor.itens.map((item) => (
                  <ItemLink key={item.href} item={item} ativo={estaAtivo(item.href)} onNavigate={onNavigate} />
                ))}
              </div>
            )}
          </div>
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
      <aside className="hidden md:flex w-64 shrink-0 bg-brand-ink text-white flex-col">
        <Brand />
        <NavLinks />
        <div className="px-3 py-4 border-t border-white/10">
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
