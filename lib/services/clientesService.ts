import type { SupabaseClient } from "@supabase/supabase-js";
import { clientesRepository } from "@/lib/repositories/clientesRepository";
import { equipamentosRepository } from "@/lib/repositories/equipamentosRepository";
import { documentosRepository } from "@/lib/repositories/documentosRepository";
import { inspecoesRepository } from "@/lib/repositories/inspecoesRepository";
import { laudosRepository } from "@/lib/repositories/laudosRepository";
import { agendaRepository } from "@/lib/repositories/agendaRepository";
import { listHistoricoPipeline } from "@/lib/pipeline";
import { calcularUrgencia, hojeBrasiliaStr } from "@/lib/alerts";
import { montarDiagnostico } from "@/lib/diagnostico";
import { labelEtapa } from "@/types/pipeline";
import type { Cliente, ClienteInput } from "@/types/cliente";

/** Erro de validação de negócio, distinto de erros de rede/banco. */
export class ValidationError extends Error {}

function validate(input: ClienteInput) {
  if (!input.razao_social || !input.razao_social.trim()) {
    throw new ValidationError(
      input.tipo_pessoa === "fisica" ? "Nome completo é obrigatório." : "Razão social é obrigatória."
    );
  }

  if (input.tipo_pessoa === "juridica") {
    if (input.cnpj && input.cnpj.replace(/\D/g, "").length !== 14) {
      throw new ValidationError("CNPJ inválido — deve ter 14 dígitos.");
    }
  } else if (input.tipo_pessoa === "fisica") {
    if (input.cpf && input.cpf.replace(/\D/g, "").length !== 11) {
      throw new ValidationError("CPF inválido — deve ter 11 dígitos.");
    }
  }

  if (input.cep && input.cep.replace(/\D/g, "").length !== 8) {
    throw new ValidationError("CEP inválido — deve ter 8 dígitos.");
  }

  if (input.email && !/^\S+@\S+\.\S+$/.test(input.email)) {
    throw new ValidationError("E-mail inválido.");
  }
}

/**
 * Service: regra de negócio + orquestração. Páginas chamam o service,
 * nunca o repository ou o Supabase diretamente.
 */
export const clientesService = {
  list(supabase: SupabaseClient): Promise<Cliente[]> {
    return clientesRepository.list(supabase);
  },

  async create(supabase: SupabaseClient, input: ClienteInput): Promise<Cliente> {
    validate(input);
    return clientesRepository.create(supabase, input);
  },

  async update(supabase: SupabaseClient, id: string, input: ClienteInput): Promise<Cliente> {
    validate(input);
    return clientesRepository.update(supabase, id, input);
  },

  remove(supabase: SupabaseClient, id: string): Promise<void> {
    return clientesRepository.remove(supabase, id);
  },

  /**
   * Carrega tudo que a página de detalhe do cliente precisa: dados
   * cadastrais, equipamentos, documentos, últimas inspeções, diagnóstico
   * (IFC), próximos vencimentos, timeline consolidada, próxima visita
   * agendada e data do último relatório. Retorna null se o id não existe.
   */
  async carregarDetalhe(supabase: SupabaseClient, id: string) {
    const cliente = await clientesRepository.getById(supabase, id);
    if (!cliente) return null;

    const [equipamentos, documentos, inspecoes, pipelineHist, laudos, agendaConcluida, proximaVisita] =
      await Promise.all([
        equipamentosRepository.listPorCliente(supabase, id),
        documentosRepository.listPorCliente(supabase, id, { apenasVigentes: false }),
        inspecoesRepository.listPorCliente(supabase, id, 8),
        listHistoricoPipeline(supabase, id),
        laudosRepository.listDiagnosticosPorCliente(supabase, id),
        agendaRepository.listConcluidosPorCliente(supabase, id, 20),
        agendaRepository.getProximaPorCliente(supabase, id, hojeBrasiliaStr()),
      ]);

    const diagnostico = montarDiagnostico(equipamentos as any, documentos as any);

    // Próximas inspeções/vencimentos: cada equipamento, sua data mais urgente
    const proximosVencimentos = equipamentos
      .map((eq) => {
        const campos = [
          { label: "Inspeção", data: eq.proxima_inspecao },
          { label: "Recarga", data: eq.proxima_recarga },
          { label: "Teste hidrostático", data: eq.proximo_teste_hidrostatico },
        ];
        let melhor: { label: string; urgencia: ReturnType<typeof calcularUrgencia> } | null = null;
        for (const campo of campos) {
          const u = calcularUrgencia(campo.data);
          if (!u) continue;
          if (!melhor || u.diasRestantes < melhor.urgencia!.diasRestantes) {
            melhor = { label: campo.label, urgencia: u };
          }
        }
        return melhor ? { equipamento: eq, ...melhor } : null;
      })
      .filter((v): v is NonNullable<typeof v> => v !== null)
      .sort((a, b) => a.urgencia!.diasRestantes - b.urgencia!.diasRestantes)
      .slice(0, 6);

    const codigoPorEquipamento = new Map(equipamentos.map((eq) => [eq.id, eq.codigo_interno]));

    // A página exibe i.equipamentos?.codigo_interno (antes vinha de um join) —
    // mantemos esse mesmo formato aqui pra não precisar mexer na página.
    const inspecoesComEquipamento = inspecoes.map((insp) => ({
      ...insp,
      equipamentos: { codigo_interno: codigoPorEquipamento.get(insp.equipamento_id) ?? null },
    }));

    type EventoTimeline = { data: string; tipo: string; titulo: string; detalhe?: string };
    const timeline: EventoTimeline[] = [];

    timeline.push({ data: cliente.created_at, tipo: "cadastro", titulo: "Cliente cadastrado no sistema" });

    for (const doc of documentos) {
      timeline.push({ data: doc.created_at, tipo: "documento", titulo: `Documento enviado: ${doc.tipo}`, detalhe: doc.nome_arquivo });
    }

    for (const insp of inspecoes) {
      timeline.push({
        data: insp.created_at,
        tipo: "inspecao",
        titulo: `Inspeção em ${codigoPorEquipamento.get(insp.equipamento_id) ?? "equipamento"}`,
        detalhe: insp.resultado === "conforme" ? "Conforme" : "Não conforme",
      });
    }

    for (const laudo of laudos) {
      timeline.push({ data: laudo.data_emissao, tipo: "diagnostico", titulo: "Diagnóstico emitido" });
    }

    for (const hist of pipelineHist) {
      timeline.push({
        data: hist.created_at,
        tipo: "pipeline",
        titulo: hist.etapa_anterior
          ? `Etapa alterada: ${labelEtapa(hist.etapa_anterior)} → ${labelEtapa(hist.etapa_nova)}`
          : `Etapa inicial definida: ${labelEtapa(hist.etapa_nova)}`,
      });
    }

    for (const ev of agendaConcluida) {
      timeline.push({ data: `${ev.data}T12:00:00`, tipo: "agenda", titulo: `${ev.titulo} concluído(a)` });
    }

    timeline.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());

    // "Último relatório" = a mais recente entre inspeção registrada e diagnóstico emitido.
    const ultimaInspecaoData = inspecoes[0]?.created_at ?? null;
    const ultimoDiagnosticoData = laudos[0]?.data_emissao ?? null;
    let ultimoRelatorio: string | null = null;
    if (ultimaInspecaoData && ultimoDiagnosticoData) {
      ultimoRelatorio =
        new Date(ultimaInspecaoData).getTime() > new Date(ultimoDiagnosticoData).getTime()
          ? ultimaInspecaoData
          : ultimoDiagnosticoData;
    } else {
      ultimoRelatorio = ultimaInspecaoData ?? ultimoDiagnosticoData;
    }

    return {
      cliente,
      equipamentos,
      documentos,
      inspecoes: inspecoesComEquipamento,
      diagnostico,
      proximosVencimentos,
      timeline,
      proximaVisita,
      ultimoRelatorio,
    };
  },
};
