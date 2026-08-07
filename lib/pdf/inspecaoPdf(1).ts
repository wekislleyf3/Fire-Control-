import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cliente } from "@/types/cliente";
import type { Equipamento } from "@/types/equipamento";
import type { Inspecao } from "@/types/inspecao";
import { getChecklistDoProcedimento } from "@/lib/metodoFire";
import { createClient } from "@/lib/supabase/client";
import { desenharSeloAutenticidade, type AutenticacaoLaudo } from "@/lib/pdf/seloAutenticidade";
import { baixarPdf } from "@/lib/pdf/baixarPdf";
import { CORES, desenharCabecalho, desenharRodape, desenharCardInfo, desenharCallout } from "@/lib/pdf/documentoBase";

export type { AutenticacaoLaudo };

/**
 * Gera e baixa (no navegador) o PDF de uma inspeção já registrada.
 *
 * `autenticacao` deve vir do endpoint POST /api/laudos/emitir, chamado
 * automaticamente ao salvar a inspeção (e de novo, de forma idempotente,
 * antes de gerar o PDF) — então todo laudo novo já nasce com token/hash
 * gravados no banco antes mesmo de o PDF ser desenhado. Só fica nulo em
 * cenários de falha de rede pontual; ver aviso de "selo pendente" abaixo.
 */
export async function gerarInspecaoPdf(
  inspecao: Inspecao,
  cliente: Cliente | undefined,
  equipamento: Equipamento | undefined,
  autenticacao: AutenticacaoLaudo | null
) {
  const doc = new jsPDF();
  const numeroDocumento = inspecao.id.slice(0, 8).toUpperCase();
  const dataInspecaoFmt = new Date(inspecao.created_at).toLocaleDateString("pt-BR");

  let y = desenharCabecalho(doc, {
    tituloDocumento: "Relatório de Inspeção",
    numeroDocumento,
    dataDocumento: dataInspecaoFmt,
  });

  const documentoPessoa =
    cliente?.tipo_pessoa === "fisica" ? { rotulo: "CPF", valor: cliente?.cpf } : { rotulo: "CNPJ", valor: cliente?.cnpj };
  const cidadeUf = cliente ? [cliente.cidade, cliente.estado].filter(Boolean).join("/") : "";
  const tipoEquipamento = inspecao.tipo_equipamento_snapshot ?? equipamento?.tipo ?? "—";

  y = desenharCardInfo(doc, y, [
    [{ label: "Cliente", valor: cliente?.razao_social ?? "—" }, { label: "Matrícula", valor: cliente?.matricula ?? "—" }],
    [{ label: documentoPessoa.rotulo, valor: documentoPessoa.valor ?? "—" }, { label: "Cidade/UF", valor: cidadeUf || "—" }],
    [
      { label: "Equipamento", valor: `${equipamento?.codigo_interno ?? "—"} — ${tipoEquipamento}` },
      { label: "Localização", valor: equipamento?.localizacao ?? "—" },
    ],
    [{ label: "Data da inspeção", valor: dataInspecaoFmt }, { label: "Técnico responsável", valor: inspecao.responsavel_tecnico ?? "—" }],
  ]);
  y += 8;

  // Checklist
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CORES.tinta);
  doc.text("Itens verificados", 14, y);
  y += 4;

  const itens = await getChecklistDoProcedimento(
    createClient(),
    tipoEquipamento !== "—" ? tipoEquipamento : null
  );
  const linhas = itens.map((item) => {
    const resposta = inspecao.itens_checklist?.[item.key];
    const invertido = item.key.startsWith("necessita_manutencao");
    const conforme = invertido ? resposta !== true : resposta === true;
    return [item.label, conforme ? "Conforme" : "Não conforme"];
  });

  autoTable(doc, {
    startY: y,
    head: [["Item verificado", "Resultado"]],
    body: linhas,
    headStyles: { fillColor: CORES.tinta, textColor: 255, fontSize: 9, fontStyle: "bold" },
    styles: { fontSize: 9, cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }, textColor: CORES.tinta },
    alternateRowStyles: { fillColor: CORES.fundoCard },
    columnStyles: { 0: { cellWidth: 137 }, 1: { cellWidth: 45, halign: "center" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        if (data.cell.raw === "Não conforme") {
          data.cell.styles.textColor = CORES.vermelho;
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = CORES.verde;
        }
      }
    },
  });

  // @ts-expect-error — lastAutoTable é injetado pelo plugin jspdf-autotable
  const finalY = (doc.lastAutoTable?.finalY ?? y + 20) + 8;

  const aprovado = inspecao.resultado === "conforme";
  const alturaBoxes = 42;

  desenharCallout(doc, {
    x: 14,
    y: finalY,
    largura: 108,
    altura: alturaBoxes,
    positivo: aprovado,
    titulo: aprovado ? "EQUIPAMENTO CONFORME" : "NÃO CONFORMIDADE DETECTADA",
    corpo: aprovado
      ? "Equipamento atende aos requisitos técnicos verificados nesta inspeção."
      : "Recomenda-se adequação/manutenção imediata conforme apontamentos acima.",
  });

  // Selo de autenticidade — QR + token verificáveis em /verificar/[token].
  // O token é um UUID salvo em `laudos_autenticacao` junto com um hash
  // SHA-256 do conteúdo da inspeção (lib/documentoHash.ts): a página de
  // verificação recalcula esse hash a partir dos dados atuais no banco e só
  // confirma "autêntico" se ele bater com o que foi gravado na emissão —
  // então ninguém consegue forjar um token válido nem adulterar os dados
  // depois sem que a verificação denuncie.
  await desenharSeloAutenticidade(doc, autenticacao, { x: 126, y: finalY, largura: 70, altura: alturaBoxes });

  let y2 = finalY + alturaBoxes + 10;
  if (inspecao.observacoes) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...CORES.tinta);
    doc.text("Observações", 14, y2);
    y2 += 6;
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...CORES.tintaClara);
    const obsLinhas = doc.splitTextToSize(inspecao.observacoes, 180);
    doc.text(obsLinhas, 14, y2);
  }

  desenharRodape(doc, numeroDocumento);

  const nomeArquivo = `inspecao-${equipamento?.codigo_interno ?? inspecao.id}-${new Date(
    inspecao.created_at
  )
    .toISOString()
    .slice(0, 10)}.pdf`;
  baixarPdf(doc, nomeArquivo);
}
