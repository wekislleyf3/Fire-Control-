import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularUrgencia } from "@/lib/alerts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PendenciaEquipamento = {
  codigo: string;
  cliente: string;
  tipo: string;
  tipoData: string;
  label: string;
  diasRestantes: number;
};

type PendenciaDocumento = {
  nome: string;
  cliente: string;
  tipo: string;
  validade: string;
  diasRestantes: number;
};

async function getPendencias() {
  noStore();
  const supabase = createClient();

  const [equipamentosRes, documentosRes] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("id, codigo_interno, tipo, status, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico, clientes(razao_social)"),
    supabase.from("documentos").select("id, tipo, nome_arquivo, validade, clientes(razao_social)").not("validade", "is", null),
  ]);

  const equipamentos = (equipamentosRes.data as any[]) ?? [];
  const documentos = (documentosRes.data as any[]) ?? [];

  const equipVencidos: PendenciaEquipamento[] = [];
  const equipEmAtencao: { codigo: string; cliente: string; tipo: string }[] = [];

  for (const eq of equipamentos) {
    const campos = [
      { label: "Inspeção", data: eq.proxima_inspecao },
      { label: "Recarga", data: eq.proxima_recarga },
      { label: "Teste hidrostático", data: eq.proximo_teste_hidrostatico },
    ];
    for (const campo of campos) {
      const u = calcularUrgencia(campo.data);
      if (u && (u.severity === "vencido" || u.severity === "hoje")) {
        equipVencidos.push({
          codigo: eq.codigo_interno,
          cliente: eq.clientes?.razao_social ?? "—",
          tipo: eq.tipo,
          tipoData: campo.label,
          label: u.label,
          diasRestantes: u.diasRestantes,
        });
      }
    }
    if (eq.status === "atencao") {
      equipEmAtencao.push({ codigo: eq.codigo_interno, cliente: eq.clientes?.razao_social ?? "—", tipo: eq.tipo });
    }
  }
  equipVencidos.sort((a, b) => a.diasRestantes - b.diasRestantes);

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const docVencidos: PendenciaDocumento[] = documentos
    .map((d) => {
      const validade = new Date(d.validade + "T00:00:00");
      const diasRestantes = Math.round((validade.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return {
        nome: d.nome_arquivo,
        cliente: d.clientes?.razao_social ?? "—",
        tipo: d.tipo,
        validade: d.validade,
        diasRestantes,
      };
    })
    .filter((d) => d.diasRestantes < 0)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  // Agrupamento "8 extintores vencidos (inspeção)" etc.
  const grupoMap = new Map<string, number>();
  for (const p of equipVencidos) {
    const chave = `${p.tipo} — ${p.tipoData}`;
    grupoMap.set(chave, (grupoMap.get(chave) ?? 0) + 1);
  }
  const grupos = Array.from(grupoMap.entries())
    .map(([chave, total]) => ({ chave, total }))
    .sort((a, b) => b.total - a.total);

  return {
    equipVencidos,
    equipEmAtencao,
    docVencidos,
    grupos,
    total: equipVencidos.length + docVencidos.length + equipEmAtencao.length,
  };
}

export default async function PendenciasPage() {
  const p = await getPendencias();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Central de Pendências</h1>
        <p className="text-sm text-brand-slate/70">
          Tudo que precisa de ação agora, num lugar só — calculado automaticamente.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-lg border-2 border-brand-red bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Total de pendências</p>
          <p className="font-display text-3xl md:text-4xl mt-1 text-brand-red">{p.total}</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Equipamentos vencidos</p>
          <p className="font-display text-3xl md:text-4xl mt-1">{p.equipVencidos.length}</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Documentos vencidos</p>
          <p className="font-display text-3xl md:text-4xl mt-1">{p.docVencidos.length}</p>
        </div>
        <div className="rounded-lg border border-black/5 bg-white p-4 md:p-5">
          <p className="text-xs md:text-sm text-brand-slate">Equipamentos em atenção</p>
          <p className="font-display text-3xl md:text-4xl mt-1">{p.equipEmAtencao.length}</p>
        </div>
      </div>

      {p.grupos.length > 0 && (
        <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
          <p className="font-display text-lg mb-3">Por categoria</p>
          <div className="flex flex-wrap gap-2">
            {p.grupos.map((g) => (
              <span
                key={g.chave}
                className="text-sm bg-red-50 text-red-700 border border-red-200 rounded-full px-3 py-1"
              >
                {g.total} {g.chave}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <div className="px-4 md:px-5 py-3 font-display text-lg border-b border-black/5">
          Equipamentos vencidos
        </div>
        <table className="w-full text-sm min-w-[650px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Equipamento</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Pendência</th>
              <th className="px-4 py-3">Situação</th>
            </tr>
          </thead>
          <tbody>
            {p.equipVencidos.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum equipamento vencido. 🎉
                </td>
              </tr>
            )}
            {p.equipVencidos.map((e, i) => (
              <tr key={i} className="border-t border-black/5">
                <td className="px-4 py-3 font-medium">{e.codigo}</td>
                <td className="px-4 py-3">{e.cliente}</td>
                <td className="px-4 py-3">{e.tipo}</td>
                <td className="px-4 py-3">{e.tipoData}</td>
                <td className="px-4 py-3">
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">{e.label}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
        <div className="px-4 md:px-5 py-3 font-display text-lg border-b border-black/5">
          Documentos vencidos
        </div>
        <table className="w-full text-sm min-w-[650px]">
          <thead className="bg-brand-fog text-left text-brand-slate">
            <tr>
              <th className="px-4 py-3">Documento</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Venceu em</th>
            </tr>
          </thead>
          <tbody>
            {p.docVencidos.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-brand-slate/60">
                  Nenhum documento vencido. 🎉
                </td>
              </tr>
            )}
            {p.docVencidos.map((d, i) => (
              <tr key={i} className="border-t border-black/5">
                <td className="px-4 py-3">{d.nome}</td>
                <td className="px-4 py-3">{d.cliente}</td>
                <td className="px-4 py-3">{d.tipo}</td>
                <td className="px-4 py-3 text-brand-red">
                  {new Date(d.validade + "T00:00:00").toLocaleDateString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p.equipEmAtencao.length > 0 && (
        <div className="bg-white border border-black/5 rounded-lg overflow-x-auto">
          <div className="px-4 md:px-5 py-3 font-display text-lg border-b border-black/5">
            Equipamentos sinalizados em inspeção (necessitam manutenção)
          </div>
          <table className="w-full text-sm min-w-[500px]">
            <thead className="bg-brand-fog text-left text-brand-slate">
              <tr>
                <th className="px-4 py-3">Equipamento</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
              </tr>
            </thead>
            <tbody>
              {p.equipEmAtencao.map((e, i) => (
                <tr key={i} className="border-t border-black/5">
                  <td className="px-4 py-3 font-medium">{e.codigo}</td>
                  <td className="px-4 py-3">{e.cliente}</td>
                  <td className="px-4 py-3">{e.tipo}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
