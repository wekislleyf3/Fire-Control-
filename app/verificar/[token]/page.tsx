import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashConteudoInspecao } from "@/lib/documentoHash";

export const dynamic = "force-dynamic";

type LaudoComRelacoes = {
  token_validacao: string;
  hash_documento: string;
  status: "valido" | "revogado";
  data_emissao: string;
  inspecoes: {
    id: string;
    equipamento_id: string;
    cliente_id: string;
    resultado: string;
    itens_checklist: Record<string, boolean>;
    responsavel_tecnico: string | null;
    created_at: string;
    equipamentos: { codigo_interno: string; tipo: string; localizacao: string | null } | null;
    clientes: { razao_social: string; matricula: string | null } | null;
  } | null;
};

type EstadoVerificacao = "nao_pesquisado" | "autentico" | "revogado" | "invalido";

async function buscarLaudoPorToken(token: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("laudos_autenticacao")
    .select(
      `token_validacao, hash_documento, status, data_emissao,
       inspecoes (
         id, equipamento_id, cliente_id, resultado, itens_checklist, responsavel_tecnico, created_at,
         equipamentos ( codigo_interno, tipo, localizacao ),
         clientes ( razao_social, matricula )
       )`
    )
    .eq("token_validacao", token)
    .maybeSingle();

  return data as unknown as LaudoComRelacoes | null;
}

export default async function VerificarTokenPage({ params }: { params: { token: string } }) {
  noStore();

  const token = params.token?.trim();
  let estado: EstadoVerificacao = "nao_pesquisado";
  let laudo: LaudoComRelacoes | null = null;

  if (token) {
    laudo = await buscarLaudoPorToken(token);

    if (!laudo || !laudo.inspecoes) {
      estado = "invalido";
    } else {
      const hashRecalculado = hashConteudoInspecao({
        inspecaoId: laudo.inspecoes.id,
        equipamentoId: laudo.inspecoes.equipamento_id,
        clienteId: laudo.inspecoes.cliente_id,
        resultado: laudo.inspecoes.resultado,
        itensChecklist: laudo.inspecoes.itens_checklist ?? {},
        responsavelTecnico: laudo.inspecoes.responsavel_tecnico,
        dataInspecao: laudo.inspecoes.created_at,
      });

      const integro = hashRecalculado === laudo.hash_documento;

      if (!integro) {
        // Os dados da inspeção foram alterados depois desta emissão —
        // o hash gravado não bate mais com o conteúdo atual.
        estado = "invalido";
      } else if (laudo.status === "revogado") {
        estado = "revogado";
      } else {
        estado = "autentico";
      }
    }
  }

  const inspecao = laudo?.inspecoes ?? null;

  return (
    <div className="min-h-screen bg-brand-fog flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-black/5 shadow-sm p-6">
        <p className="font-display text-2xl text-center">
          FIRECONTROL <span className="text-brand-red">OS</span>
        </p>
        <p className="text-sm text-brand-slate/70 text-center mt-1 mb-6">
          Verificação de autenticidade de laudo de inspeção
        </p>

        {estado === "invalido" && (
          <div className="rounded-md border-2 border-brand-red bg-red-50 p-4 text-center">
            <p className="font-display text-lg text-brand-red">Documento inválido ou adulterado.</p>
            <p className="text-xs text-brand-slate/70 mt-2">
              Não encontramos um laudo autêntico para esse código, ou os dados originais da inspeção
              foram alterados depois da emissão. Entre em contato com quem emitiu o documento.
            </p>
          </div>
        )}

        {estado === "revogado" && (
          <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-4 text-center">
            <p className="font-display text-lg text-amber-700">Selo substituído</p>
            <p className="text-xs text-brand-slate/70 mt-2">
              Este laudo foi reemitido depois desta versão. Peça a versão mais recente do documento a
              quem o emitiu.
            </p>
          </div>
        )}

        {estado === "autentico" && inspecao && (
          <div className="rounded-md border-2 border-green-600 bg-green-50 p-4">
            <p className="font-display text-lg text-green-700 text-center mb-3">✓ Documento autêntico</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Cliente</dt>
                <dd className="font-medium text-right">{inspecao.clientes?.razao_social ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Matrícula</dt>
                <dd className="font-medium text-right">{inspecao.clientes?.matricula ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Equipamento</dt>
                <dd className="font-medium text-right">
                  {inspecao.equipamentos?.codigo_interno ?? "—"} — {inspecao.equipamentos?.tipo ?? "—"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Localização</dt>
                <dd className="font-medium text-right">{inspecao.equipamentos?.localizacao ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Técnico responsável</dt>
                <dd className="font-medium text-right">{inspecao.responsavel_tecnico ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Data da inspeção</dt>
                <dd className="font-medium text-right">
                  {new Date(inspecao.created_at).toLocaleDateString("pt-BR")}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Situação</dt>
                <dd
                  className={`font-medium text-right ${
                    inspecao.resultado === "conforme" ? "text-green-700" : "text-brand-red"
                  }`}
                >
                  {inspecao.resultado === "conforme" ? "Conforme" : "Não conforme"}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Data de emissão</dt>
                <dd className="font-medium text-right">
                  {new Date(laudo!.data_emissao).toLocaleString("pt-BR")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <p className="text-[11px] text-brand-slate/40 text-center mt-6 break-all">
          Token {token || "—"} · verificado por hash SHA-256 recalculado no servidor
        </p>
      </div>
    </div>
  );
}
