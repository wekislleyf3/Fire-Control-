import { unstable_noStore as noStore } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { faixaDoIfc } from "@/lib/ifc";
import { ifcService } from "@/lib/services/ifcService";
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

  const [resultado, historicoBruto] = await Promise.all([ifcService.calcular(supabase), ifcService.listHistorico(supabase)]);

  const historico = historicoBruto.map((h) => {
    const [ano, mes] = h.mes_referencia.split("-");
    return { mes: `${MESES[parseInt(mes, 10) - 1]}/${ano.slice(2)}`, score: h.score };
  });

  return { resultado, historico };
}

export default async function IfcPage() {
  const { resultado, historico } = await getIfcData();
  const cor = faixaDoIfc(resultado.score);

  const componentes = [
    { label: "Equipamentos em dia", valor: resultado.pctEquipamentosOk, peso: "50%" },
    { label: "Documentos em dia", valor: resultado.pctDocumentosOk, peso: "25%" },
    { label: "Sem não conformidades", valor: resultado.pctSemNaoConformidade, peso: "25%" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-4xl">Índice FireControl</h1>
        <p className="text-base text-brand-slate/70">
          Nota única de conformidade, de 0 a 100 — pensada pra acompanhar e mostrar ao cliente.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className={`rounded-xl border-2 ${cor.border} ${cor.bg} p-7 flex flex-col items-center justify-center md:col-span-1`}>
          <p className="text-sm text-brand-slate">IFC atual</p>
          <p className={`font-display text-6xl ${cor.text}`}>{resultado.score}</p>
          <p className={`text-base font-medium mt-1 ${cor.text}`}>{cor.label}</p>
          <p className="text-xs text-brand-slate/60">de 100</p>
        </div>

        <div className="md:col-span-2 bg-white border border-black/5 rounded-xl p-6">
          <p className="font-display text-xl mb-3">Composição</p>
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
        <p className="font-display text-lg mb-3">Faixas de classificação</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2">
            <p className="font-medium text-green-700">Excelente</p>
            <p className="text-xs text-brand-slate/60">95 a 100</p>
          </div>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
            <p className="font-medium text-emerald-700">Bom</p>
            <p className="text-xs text-brand-slate/60">85 a 94</p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
            <p className="font-medium text-amber-600">Atenção</p>
            <p className="text-xs text-brand-slate/60">70 a 84</p>
          </div>
          <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2">
            <p className="font-medium text-brand-red">Crítico</p>
            <p className="text-xs text-brand-slate/60">abaixo de 70</p>
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
