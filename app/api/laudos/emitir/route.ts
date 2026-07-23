import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { hashConteudoInspecao } from "@/lib/documentoHash";

export const dynamic = "force-dynamic";

/**
 * POST /api/laudos/emitir
 * Body: { inspecaoId: string }
 *
 * Emite o token de autenticação (UUID) e o hash de integridade de uma
 * inspeção, gravando em `laudos_autenticacao`. Idempotente: se já existir
 * uma emissão válida com o mesmo hash (ou seja, os dados da inspeção não
 * mudaram desde a última emissão), devolve o mesmo token em vez de criar
 * um novo — assim reimprimir o mesmo laudo não gera tokens infinitos.
 *
 * Se os dados da inspeção mudaram desde a última emissão (hash diferente),
 * a emissão antiga é marcada como "revogada" e uma nova é criada — o token
 * antigo passa a apontar para um documento superado.
 *
 * Só usuários autenticados do FireControl OS podem chamar essa rota (a
 * verificação pública em /verificar/[token] é uma rota totalmente
 * diferente, sem autenticação, que só LÊ o que já foi emitido aqui).
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
  const inspecaoId = body?.inspecaoId;

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

  const { data: emissaoExistente } = await supabase
    .from("laudos_autenticacao")
    .select("token_validacao, hash_documento, data_emissao, status")
    .eq("inspecao_id", inspecaoId)
    .eq("status", "valido")
    .order("data_emissao", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Mesma emissão de sempre, dados não mudaram: reaproveita o token.
  if (emissaoExistente && emissaoExistente.hash_documento === hashAtual) {
    return NextResponse.json({
      token: emissaoExistente.token_validacao,
      hash: emissaoExistente.hash_documento,
      dataEmissao: emissaoExistente.data_emissao,
    });
  }

  // Dados mudaram desde a última emissão (ou nunca houve uma): revoga a
  // anterior (se existir) e cria uma emissão nova.
  if (emissaoExistente) {
    await supabase
      .from("laudos_autenticacao")
      .update({ status: "revogado" })
      .eq("token_validacao", emissaoExistente.token_validacao);
  }

  const { data: novaEmissao, error: insertError } = await supabase
    .from("laudos_autenticacao")
    .insert({
      inspecao_id: inspecaoId,
      equipamento_id: inspecao.equipamento_id,
      hash_documento: hashAtual,
      status: "valido",
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
