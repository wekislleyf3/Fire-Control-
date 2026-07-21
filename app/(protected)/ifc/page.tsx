import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calcularIFC, corDoIfc } from "@/lib/ifc";
import { calcularUrgencia } from "@/lib/alerts";
import IfcHistoricoChart from "../components/IfcHistoricoChart";
import RegistrarIfcButton from "../components/RegistrarIfcButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

async function getIfcData() {
  noStore();
  const supabase = createClient();

  const [equipamentosRes, documentosRes, historicoRes] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("id, status, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico"),
    supabase.from("documentos").select("id, validade").not("validade", "is", null),
    supabase.from("ifc_historico").select("*").order("mes_referencia", { ascending: true }),
  ]);

  const equipamentos = equipamentosRes.data ?? [];
  const documentos = documentosRes.data ?? [];

  let equipamentosVencidos = 0;
  let equipamentosEmAtencao = 0;
  for (const eq of equipamentos) {
    const vencido = [eq.proxima_inspecao, eq.proxima_recarga, eq.proximo_teste_hidrostatico].some((data) => {
      const u = calcularUrgencia(data);
      return u && (u.severity === "vencido" || u.severity === "hoje");
    });
    if (vencido) equipamentosVencidos++;
    if (eq.status === "atencao") equipamentosEmAtencao++;
  }

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const documentosVencidos = documentos.filter((d) => new Date(d.validade + "T00:00:00") < hoje).length;

  const resultado = calcularIFC({
    totalEquipamentos: equipamentos.length,
    equipamentosVencidos,
    equipamentosEmAtencao,
    totalDocumentosComValidade: documentos.length,
    documentosVencidos,
  });

  const historico = (historicoRes.data ?? []).map((h: any) => {
    const [ano, mes] = h.mes_referencia.split("-");
    return { mes: `${MESES[parseInt(mes, 10) - 1]}/${ano.slice(2)}`, score: Number(h.score) };
  });

  return { resultado, historico };
}

export default async function IfcPage() {
  const { resultado, historico } = await getIfcData();
  const cor = corDoIfc(resultado.score);

  const componentes = [
    { label: "Equipamentos em dia", valor: resultado.pctEquipamentosOk, peso: "50%" },
    { label: "Documentos em dia", valor: resultado.pctDocumentosOk, peso: "25%" },
    { label: "Sem não conformidades", valor: resultado.pctSemNaoConformidade, peso: "25%" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Índice FireControl</h1>
        <p className="text-sm text-brand-slate/70">
          Nota única de conformidade, de 0 a 100 — pensada pra acompanhar e mostrar ao cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className={`rounded-lg border-2 ${cor.border} ${cor.bg} p-6 flex flex-col items-center justify-center md:col-span-1`}>
          <p className="text-sm text-brand-slate">IFC atual</p>
          <p className={`font-display text-6xl ${cor.text}`}>{resultado.score}</p>
          <p className="text-xs text-brand-slate/60 mt-1">de 100</p>
        </div>

        <div className="md:col-span-2 bg-white border border-black/5 rounded-lg p-5">
          <p className="font-display text-lg mb-3">Composição</p>
          <div className="space-y-3">
            {componentes.map((c) => (
              <div key={c.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-brand-slate">
                    {c.label} <span className="text-brand-slate/50">(peso {c.peso})</span>
                  </span>
                  <span className="font-medium">{c.valor}%</span>
                </div>
                <div className="h-2 bg-brand-fog rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-red rounded-full"
                    style={{ width: `${c.valor}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white border border-black/5 rounded-lg p-4 md:p-5">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-3">
          <p className="font-display text-lg">Evolução mensal</p>
          <RegistrarIfcButton resultado={resultado} />
        </div>
        <IfcHistoricoChart data={historico} />
      </div>

      <p className="text-xs text-brand-slate/50">
        O registro mensal grava a nota atual como referência daquele mês (um por mês — registrar de
        novo no mesmo mês atualiza o valor). Assim dá pra mostrar ao cliente a evolução: "Julho 82%
        → Agosto 91% → Setembro 96%".
      </p>
    </div>
  );
}
