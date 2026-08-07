import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashConteudoInspecao, hashConteudoDiagnostico, hashConteudoOrdemServico } from "@/lib/documentoHash";

export const dynamic = "force-dynamic";

/**
 * POST /api/laudos/emitir
 *
 * Body para laudo de inspeção (comportamento original):
 *   { tipoDocumento?: "inspecao", inspecaoId: string }
 *
 * Body para diagnóstico de cliente:
 *   { tipoDocumento: "diagnostico", clienteId: string }
 *
 * Body para Ordem de Serviço:
 *   { tipoDocumento: "ordem_servico", ordemServicoId: string }
 *
 * Em todos os casos, o servidor busca os dados DIRETO do banco (nunca
 * confia em nada que o navegador mande sobre o conteúdo do documento) e
 * calcula o hash em cima disso — é o que garante que o selo reflita o
 * estado real, e não o que alguém tentou forjar no payload da requisição.
 */
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const tipoDocumento: "inspecao" | "diagnostico" | "ordem_servico" =
    body?.tipoDocumento === "diagnostico"
      ? "diagnostico"
      : body?.tipoDocumento === "ordem_servico"
        ? "ordem_servico"
        : "inspecao";

  if (tipoDocumento === "diagnostico") {
    return emitirSeloDiagnostico(supabase, body?.clienteId);
  }
  if (tipoDocumento === "ordem_servico") {
    return emitirSeloOrdemServico(supabase, body?.ordemServicoId);
  }
  return emitirSeloInspecao(supabase, body?.inspecaoId);
}

async function emitirSeloInspecao(supabase: ReturnType<typeof createClient>, inspecaoId: unknown) {
  if (!inspecaoId || typeof inspecaoId !== "string") {
    return NextResponse.json({ error: "inspecaoId é obrigatório." }, { status: 400 });
  }

  const { data: inspecao, error: fetchError } = await supabase
    .from("inspecoes")
    .select("id, equipamento_id, cliente_id, resultado, itens_checklist, responsavel_tecnico, created_at")
    .eq("id", inspecaoId)
    .single();

  if (fetchError || !inspecao) {
    return NextResponse.json({ error: "Inspeção não encontrada." }, { status: 404 });
  }

  const hashAtual = hashConteudoInspecao({
    inspecaoId: inspecao.id,
    equipamentoId: inspecao.equipamento_id,
    clienteId: inspecao.cliente_id,
    resultado: inspecao.resultado,
    itensChecklist: (inspecao.itens_checklist as Record<string, boolean>) ?? {},
    responsavelTecnico: inspecao.responsavel_tecnico,
    dataInspecao: inspecao.created_at,
  });

  return emitirOuReaproveitar(supabase, {
    tipoDocumento: "inspecao",
    filtro: { inspecao_id: inspecaoId },
    hashAtual,
    dadosParaInsert: { inspecao_id: inspecaoId, equipamento_id: inspecao.equipamento_id },
  });
}

async function emitirSeloDiagnostico(supabase: ReturnType<typeof createClient>, clienteId: unknown) {
  if (!clienteId || typeof clienteId !== "string") {
    return NextResponse.json({ error: "clienteId é obrigatório." }, { status: 400 });
  }

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .select("id")
    .eq("id", clienteId)
    .single();

  if (clienteError || !cliente) {
    return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
  }

  const [equipamentosRes, documentosRes] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("codigo_interno, tipo, status, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico")
      .eq("cliente_id", clienteId),
    supabase.from("documentos").select("tipo, validade").eq("cliente_id", clienteId),
  ]);

  const hashAtual = hashConteudoDiagnostico({
    clienteId,
    equipamentos: equipamentosRes.data ?? [],
    documentos: documentosRes.data ?? [],
  });

  return emitirOuReaproveitar(supabase, {
    tipoDocumento: "diagnostico",
    filtro: { cliente_id: clienteId },
    hashAtual,
    dadosParaInsert: { cliente_id: clienteId },
  });
}

async function emitirSeloOrdemServico(supabase: ReturnType<typeof createClient>, ordemServicoId: unknown) {
  if (!ordemServicoId || typeof ordemServicoId !== "string") {
    return NextResponse.json({ error: "ordemServicoId é obrigatório." }, { status: 400 });
  }

  const { data: os, error: fetchError } = await supabase
    .from("ordens_servico")
    .select(
      "id, cliente_id, tipo, data, responsavel_tecnico, status, assinatura_nome, assinatura_data, itens:ordens_servico_itens(equipamento_id, verificado)"
    )
    .eq("id", ordemServicoId)
    .single();

  if (fetchError || !os) {
    return NextResponse.json({ error: "Ordem de Serviço não encontrada." }, { status: 404 });
  }

  const hashAtual = hashConteudoOrdemServico({
    ordemServicoId: os.id,
    clienteId: os.cliente_id,
    tipo: os.tipo,
    data: os.data,
    responsavelTecnico: os.responsavel_tecnico,
    status: os.status,
    itens: (os.itens ?? []).map((i: { equipamento_id: string | null; verificado: boolean }) => ({
      equipamentoId: i.equipamento_id,
      verificado: i.verificado,
    })),
    assinaturaNome: os.assinatura_nome,
    assinaturaData: os.assinatura_data,
  });

  return emitirOuReaproveitar(supabase, {
    tipoDocumento: "ordem_servico",
    filtro: { ordem_servico_id: ordemServicoId },
    hashAtual,
    dadosParaInsert: { ordem_servico_id: ordemServicoId, cliente_id: os.cliente_id },
  });
}

async function emitirOuReaproveitar(
  supabase: ReturnType<typeof createClient>,
  params: {
    tipoDocumento: "inspecao" | "diagnostico" | "ordem_servico";
    filtro: Record<string, string>;
    hashAtual: string;
    dadosParaInsert: Record<string, string | null>;
  }
) {
  let query = supabase
    .from("laudos_autenticacao")
    .select("token_validacao, hash_documento, data_emissao, status")
    .eq("tipo_documento", params.tipoDocumento)
    .eq("status", "valido")
    .order("data_emissao", { ascending: false })
    .limit(1);

  for (const [coluna, valor] of Object.entries(params.filtro)) {
    query = query.eq(coluna, valor);
  }

  const { data: emissaoExistente } = await query.maybeSingle();

  if (emissaoExistente && emissaoExistente.hash_documento === params.hashAtual) {
    return NextResponse.json({
      token: emissaoExistente.token_validacao,
      hash: emissaoExistente.hash_documento,
      dataEmissao: emissaoExistente.data_emissao,
    });
  }

  if (emissaoExistente) {
    await supabase
      .from("laudos_autenticacao")
      .update({ status: "revogado" })
      .eq("token_validacao", emissaoExistente.token_validacao);
  }

  const { data: novaEmissao, error: insertError } = await supabase
    .from("laudos_autenticacao")
    .insert({
      tipo_documento: params.tipoDocumento,
      hash_documento: params.hashAtual,
      status: "valido",
      ...params.dadosParaInsert,
    })
    .select("token_validacao, hash_documento, data_emissao")
    .single();

  if (insertError || !novaEmissao) {
    return NextResponse.json(
      { error: `Erro ao emitir selo: ${insertError?.message ?? "erro desconhecido"}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    token: novaEmissao.token_validacao,
    hash: novaEmissao.hash_documento,
    dataEmissao: novaEmissao.data_emissao,
  });
}
