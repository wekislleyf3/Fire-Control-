import type { SupabaseClient } from "@supabase/supabase-js";
import { ifcRepository } from "@/lib/repositories/ifcRepository";
import { calcularIFC, type IfcResultado } from "@/lib/ifc";
import { calcularUrgencia, calcularStatusEquipamento, hojeBrasilia } from "@/lib/alerts";

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const ifcService = {
  async calcular(supabase: SupabaseClient): Promise<IfcResultado> {
    const [equipamentos, documentos] = await Promise.all([
      ifcRepository.listEquipamentosParaCalculo(supabase),
      ifcRepository.listDocumentosComValidade(supabase),
    ]);

    let equipamentosVencidos = 0;
    let equipamentosEmAtencao = 0;
    for (const eq of equipamentos) {
      const vencido = [eq.proxima_inspecao, eq.proxima_recarga, eq.proximo_teste_hidrostatico].some((data) => {
        const u = calcularUrgencia(data);
        return u && (u.severity === "vencido" || u.severity === "hoje");
      });
      if (vencido) equipamentosVencidos++;
      else if (calcularStatusEquipamento(eq) === "atencao") equipamentosEmAtencao++;
    }

    const hoje = hojeBrasilia();
    const documentosVencidos = documentos.filter((d) => new Date(d.validade + "T00:00:00-03:00") < hoje).length;

    return calcularIFC({
      totalEquipamentos: equipamentos.length,
      equipamentosVencidos,
      equipamentosEmAtencao,
      totalDocumentosComValidade: documentos.length,
      documentosVencidos,
    });
  },

  async listHistorico(supabase: SupabaseClient): Promise<{ mes_referencia: string; score: number }[]> {
    const historico = await ifcRepository.listHistorico(supabase);
    return historico.map((h) => ({ mes_referencia: h.mes_referencia, score: Number(h.score) }));
  },

  /** Registra a nota atual como referência do mês corrente (ver comentário no repository sobre o upsert). */
  registrarMesAtual(supabase: SupabaseClient, resultado: IfcResultado): Promise<void> {
    const hoje = hojeBrasilia();
    const mesReferencia = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}-01`;
    return ifcRepository.upsertHistoricoDoMes(supabase, {
      mes_referencia: mesReferencia,
      score: resultado.score,
      pct_equipamentos_ok: resultado.pctEquipamentosOk,
      pct_documentos_ok: resultado.pctDocumentosOk,
      pct_sem_nao_conformidade: resultado.pctSemNaoConformidade,
    });
  },
};
