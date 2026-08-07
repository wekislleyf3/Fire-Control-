import { unstable_noStore as noStore } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashConteudoInspecao, hashConteudoDiagnostico, hashConteudoOrdemServico } from "@/lib/documentoHash";
import { montarDiagnostico } from "@/lib/diagnostico";

export const dynamic = "force-dynamic";

type LinhaLaudo = {
  token_validacao: string;
  hash_documento: string;
  status: "valido" | "revogado";
  data_emissao: string;
  tipo_documento: "inspecao" | "diagnostico" | "ordem_servico";
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
  clientes: { id: string; razao_social: string; matricula: string | null } | null;
  ordens_servico: {
    id: string;
    cliente_id: string;
    tipo: "vistoria" | "levantamento";
    data: string;
    responsavel_tecnico: string | null;
    status: "aberta" | "concluida" | "cancelada";
    assinatura_nome: string | null;
    assinatura_data: string | null;
    itens: { equipamento_id: string | null; verificado: boolean }[];
    clientes: { razao_social: string; matricula: string | null } | null;
  } | null;
};

type EstadoVerificacao = "nao_pesquisado" | "autentico" | "revogado" | "invalido" | "desatualizado";

async function buscarLaudoPorToken(token: string) {
  const supabase = createAdminClient();

  const { data } = await supabase
    .from("laudos_autenticacao")
    .select(
      `token_validacao, hash_documento, status, data_emissao, tipo_documento,
       inspecoes (
         id, equipamento_id, cliente_id, resultado, itens_checklist, responsavel_tecnico, created_at,
         equipamentos ( codigo_interno, tipo, localizacao ),
         clientes ( razao_social, matricula )
       ),
       clientes ( id, razao_social, matricula ),
       ordens_servico (
         id, cliente_id, tipo, data, responsavel_tecnico, status, assinatura_nome, assinatura_data,
         itens:ordens_servico_itens ( equipamento_id, verificado ),
         clientes ( razao_social, matricula )
       )`
    )
    .eq("token_validacao", token)
    .maybeSingle();

  return data as unknown as LinhaLaudo | null;
}

/** Recalcula o hash de integridade do diagnóstico (dados brutos) e monta a versão atual pra exibição. */
async function recalcularHashDiagnostico(clienteId: string) {
  const supabase = createAdminClient();

  const [equipamentosRes, documentosRes] = await Promise.all([
    supabase
      .from("equipamentos")
      .select("codigo_interno, tipo, status, proxima_inspecao, proxima_recarga, proximo_teste_hidrostatico")
      .eq("cliente_id", clienteId),
    supabase.from("documentos").select("tipo, validade").eq("cliente_id", clienteId),
  ]);

  const equipamentos = equipamentosRes.data ?? [];
  const documentos = documentosRes.data ?? [];

  return {
    hash: hashConteudoDiagnostico({ clienteId, equipamentos, documentos }),
    // O diagnóstico exibido na tela é sempre o ATUAL (usa dias-restantes,
    // que mudam com o tempo) — isso é só pra mostrar o estado de hoje.
    // A autenticidade em si é conferida pelo hash acima, que usa dados
    // brutos e não muda sozinho com a passagem do tempo.
    diagnostico: montarDiagnostico(equipamentos, documentos),
  };
}

export default async function VerificarTokenPage({ params }: { params: { token: string } }) {
  noStore();

  const token = params.token?.trim();
  let estado: EstadoVerificacao = "nao_pesquisado";
  let laudo: LinhaLaudo | null = null;
  let diagnosticoAtual: Awaited<ReturnType<typeof recalcularHashDiagnostico>>["diagnostico"] | null = null;

  if (token) {
    laudo = await buscarLaudoPorToken(token);

    if (!laudo) {
      estado = "invalido";
    } else if (laudo.tipo_documento === "inspecao") {
      if (!laudo.inspecoes) {
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
        estado = !integro ? "invalido" : laudo.status === "revogado" ? "revogado" : "autentico";
      }
    } else if (laudo.tipo_documento === "diagnostico") {
      // diagnóstico
      if (!laudo.clientes) {
        estado = "invalido";
      } else {
        const { hash, diagnostico } = await recalcularHashDiagnostico(laudo.clientes.id);
        diagnosticoAtual = diagnostico;
        const integro = hash === laudo.hash_documento;
        estado = !integro ? "desatualizado" : laudo.status === "revogado" ? "revogado" : "autentico";
      }
    } else {
      // ordem de serviço
      if (!laudo.ordens_servico) {
        estado = "invalido";
      } else {
        const os = laudo.ordens_servico;
        const hashRecalculado = hashConteudoOrdemServico({
          ordemServicoId: os.id,
          clienteId: os.cliente_id,
          tipo: os.tipo,
          data: os.data,
          responsavelTecnico: os.responsavel_tecnico,
          status: os.status,
          itens: (os.itens ?? []).map((i) => ({ equipamentoId: i.equipamento_id, verificado: i.verificado })),
          assinaturaNome: os.assinatura_nome,
          assinaturaData: os.assinatura_data,
        });
        const integro = hashRecalculado === laudo.hash_documento;
        estado = !integro ? "invalido" : laudo.status === "revogado" ? "revogado" : "autentico";
      }
    }
  }

  const inspecao = laudo?.tipo_documento === "inspecao" ? laudo.inspecoes : null;
  const clienteDiagnostico = laudo?.tipo_documento === "diagnostico" ? laudo.clientes : null;
  const ordemServico = laudo?.tipo_documento === "ordem_servico" ? laudo.ordens_servico : null;

  return (
    <div className="min-h-screen bg-brand-fog flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-lg border border-black/5 shadow-sm p-6">
        <p className="font-display text-2xl text-center">
          FIRECONTROL <span className="text-brand-red">OS</span>
        </p>
        <p className="text-sm text-brand-slate/70 text-center mt-1 mb-6">
          Verificação de autenticidade de documento
        </p>

        {estado === "invalido" && (
          <div className="rounded-md border-2 border-brand-red bg-red-50 p-4 text-center">
            <p className="font-display text-lg text-brand-red">Documento inválido ou adulterado.</p>
            <p className="text-xs text-brand-slate/70 mt-2">
              Não encontramos um documento autêntico para esse código, ou os dados originais foram
              alterados depois da emissão. Entre em contato com quem emitiu o documento.
            </p>
          </div>
        )}

        {estado === "revogado" && (
          <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-4 text-center">
            <p className="font-display text-lg text-amber-700">Selo substituído</p>
            <p className="text-xs text-brand-slate/70 mt-2">
              Este documento foi reemitido depois desta versão. Peça a versão mais recente a quem o
              emitiu.
            </p>
          </div>
        )}

        {estado === "autentico" && inspecao && (
          <div className="rounded-md border-2 border-green-600 bg-green-50 p-4">
            <p className="font-display text-lg text-green-700 text-center mb-3">✓ Documento autêntico</p>
            <p className="text-xs text-brand-slate/50 text-center mb-3">Laudo de inspeção</p>
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

        {estado === "autentico" && ordemServico && (
          <div className="rounded-md border-2 border-green-600 bg-green-50 p-4">
            <p className="font-display text-lg text-green-700 text-center mb-3">✓ Documento autêntico</p>
            <p className="text-xs text-brand-slate/50 text-center mb-3">
              Ordem de Serviço · {ordemServico.tipo === "levantamento" ? "Levantamento / cadastro" : "Vistoria de equipamentos"}
            </p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Cliente</dt>
                <dd className="font-medium text-right">{ordemServico.clientes?.razao_social ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Matrícula</dt>
                <dd className="font-medium text-right">{ordemServico.clientes?.matricula ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Técnico responsável</dt>
                <dd className="font-medium text-right">{ordemServico.responsavel_tecnico ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Data da visita</dt>
                <dd className="font-medium text-right">
                  {new Date(ordemServico.data + "T00:00:00").toLocaleDateString("pt-BR")}
                </dd>
              </div>
              {ordemServico.tipo === "vistoria" && (
                <div className="flex justify-between gap-3">
                  <dt className="text-brand-slate/60 shrink-0">Equipamentos vistoriados</dt>
                  <dd className="font-medium text-right">
                    {ordemServico.itens.filter((i) => i.verificado).length} de {ordemServico.itens.length}
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Assinado por</dt>
                <dd className="font-medium text-right">{ordemServico.assinatura_nome ?? "não assinado"}</dd>
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

        {estado === "desatualizado" && clienteDiagnostico && diagnosticoAtual && (
          <div className="rounded-md border-2 border-amber-500 bg-amber-50 p-4">
            <p className="font-display text-lg text-amber-700 text-center mb-1">⚠ Diagnóstico desatualizado</p>
            <p className="text-xs text-brand-slate/70 text-center mb-3">
              Os dados de equipamentos/documentos deste cliente mudaram desde que este PDF foi emitido.
              O que está abaixo é o estado ATUAL — pode ser diferente do que está impresso no documento.
            </p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Cliente</dt>
                <dd className="font-medium text-right">{clienteDiagnostico.razao_social}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Equipamentos analisados (hoje)</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.totalEquipamentos}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Pendências (hoje)</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.equipamentosPendentes}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">IFC atual</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.ifc.score}%</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Este PDF foi emitido em</dt>
                <dd className="font-medium text-right">
                  {new Date(laudo!.data_emissao).toLocaleString("pt-BR")}
                </dd>
              </div>
            </dl>
          </div>
        )}

        {estado === "autentico" && clienteDiagnostico && diagnosticoAtual && (
          <div className="rounded-md border-2 border-green-600 bg-green-50 p-4">
            <p className="font-display text-lg text-green-700 text-center mb-3">✓ Documento autêntico</p>
            <p className="text-xs text-brand-slate/50 text-center mb-3">Diagnóstico de conformidade</p>
            <dl className="text-sm space-y-2">
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Cliente</dt>
                <dd className="font-medium text-right">{clienteDiagnostico.razao_social}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Matrícula</dt>
                <dd className="font-medium text-right">{clienteDiagnostico.matricula ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Equipamentos analisados</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.totalEquipamentos}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Em conformidade</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.equipamentosConformes}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">Pendências</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.equipamentosPendentes}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-brand-slate/60 shrink-0">IFC (Índice FireControl)</dt>
                <dd className="font-medium text-right">{diagnosticoAtual.ifc.score}%</dd>
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
          Código {token || "—"} · verificação eletrônica de autenticidade
        </p>
      </div>
    </div>
  );
}
