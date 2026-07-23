import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import QRCode from "qrcode";
import type { Cliente } from "@/types/cliente";
import { enderecoCompleto } from "@/types/cliente";
import type { Equipamento } from "@/types/equipamento";
import type { Inspecao } from "@/types/inspecao";
import { getChecklistParaTipo } from "@/lib/checklists";

export type AutenticacaoLaudo = {
  token: string;
  hash: string;
  dataEmissao: string;
};

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
  const vermelho: [number, number, number] = [196, 30, 30];
  const cinza: [number, number, number] = [90, 90, 90];

  // Cabeçalho corporativo (faixa vermelha no topo)
  doc.setFillColor(...vermelho);
  doc.rect(0, 0, 210, 26, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("FireControl OS", 14, 13);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("RELATÓRIO TÉCNICO DE INSPEÇÃO", 14, 20);

  doc.text(`LAUDO Nº: ${inspecao.id.slice(0, 8).toUpperCase()}`, 196, 13, { align: "right" });
  doc.text(new Date(inspecao.created_at).toLocaleDateString("pt-BR"), 196, 20, { align: "right" });

  let y = 38;
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);

  doc.setFont("helvetica", "bold");
  doc.text("Cliente", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(cliente?.razao_social ?? "—", 40, y);

  doc.setFont("helvetica", "bold");
  doc.text("Matrícula", 140, y);
  doc.setFont("helvetica", "normal");
  doc.text(cliente?.matricula ?? "—", 168, y);
  y += 6;

  const documento =
    cliente?.tipo_pessoa === "fisica"
      ? { rotulo: "CPF", valor: cliente?.cpf }
      : { rotulo: "CNPJ", valor: cliente?.cnpj };
  doc.setFont("helvetica", "bold");
  doc.text(documento.rotulo, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(documento.valor ?? "—", 40, y);
  y += 6;

  const endereco = cliente ? enderecoCompleto(cliente) : "";
  doc.setFont("helvetica", "bold");
  doc.text("Endereço", 14, y);
  doc.setFont("helvetica", "normal");
  const enderecoLinhas = doc.splitTextToSize(endereco || "—", 145);
  doc.text(enderecoLinhas, 40, y);
  y += 6 * enderecoLinhas.length + 4;

  doc.setDrawColor(225, 225, 225);
  doc.line(14, y, 196, y);
  y += 8;

  doc.setFont("helvetica", "bold");
  doc.text("Equipamento", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(
    `${equipamento?.codigo_interno ?? "—"} — ${inspecao.tipo_equipamento_snapshot ?? equipamento?.tipo ?? "—"}`,
    50,
    y
  );
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Localização", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(equipamento?.localizacao ?? "—", 50, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Data da inspeção", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date(inspecao.created_at).toLocaleDateString("pt-BR"), 50, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.text("Técnico responsável", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(inspecao.responsavel_tecnico ?? "—", 50, y);
  y += 10;

  // Checklist
  const itens = getChecklistParaTipo(inspecao.tipo_equipamento_snapshot ?? equipamento?.tipo ?? null);
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
    headStyles: { fillColor: vermelho, textColor: 255, fontSize: 9 },
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: { 1: { cellWidth: 40, halign: "center" } },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 1) {
        if (data.cell.raw === "Não conforme") {
          data.cell.styles.textColor = [196, 30, 30];
          data.cell.styles.fontStyle = "bold";
        } else {
          data.cell.styles.textColor = [30, 130, 76];
        }
      }
    },
  });

  // @ts-expect-error — lastAutoTable é injetado pelo plugin jspdf-autotable
  const finalY = (doc.lastAutoTable?.finalY ?? y + 20) + 8;

  const aprovado = inspecao.resultado === "conforme";
  const verde: [number, number, number] = [22, 101, 52];
  const verdeClaro: [number, number, number] = [240, 253, 244];
  const vermelhoClaro: [number, number, number] = [254, 242, 242];
  const alturaBoxes = 36;

  // Parecer técnico
  doc.setDrawColor(...(aprovado ? verde : vermelho));
  doc.setFillColor(...(aprovado ? verdeClaro : vermelhoClaro));
  doc.roundedRect(14, finalY, 108, alturaBoxes, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(aprovado ? verde : vermelho));
  doc.text(`PARECER: ${aprovado ? "EQUIPAMENTO CONFORME" : "NÃO CONFORMIDADE DETECTADA"}`, 18, finalY + 8, {
    maxWidth: 100,
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(60, 60, 60);
  doc.text(
    aprovado
      ? "Equipamento atende aos requisitos técnicos verificados nesta inspeção."
      : "Recomenda-se adequação/manutenção imediata conforme apontamentos acima.",
    18,
    finalY + 16,
    { maxWidth: 98 }
  );

  // Selo de autenticidade — QR + token verificáveis em /verificar/[token].
  // O token é um UUID salvo em `laudos_autenticacao` junto com um hash
  // SHA-256 do conteúdo da inspeção (lib/documentoHash.ts): a página de
  // verificação recalcula esse hash a partir dos dados atuais no banco e só
  // confirma "autêntico" se ele bater com o que foi gravado na emissão —
  // então ninguém consegue forjar um token válido nem adulterar os dados
  // depois sem que a verificação denuncie.
  doc.setDrawColor(...vermelho);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(126, finalY, 70, alturaBoxes, 2, 2, "FD");

  if (autenticacao) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...verde);
    doc.text("✓ DOCUMENTO AUTENTICADO", 161, finalY + 6, { align: "center" });

    const urlVerificacao = `${
      typeof window !== "undefined" ? window.location.origin : ""
    }/verificar/${encodeURIComponent(autenticacao.token)}`;

    try {
      const qrDataUrl = await QRCode.toDataURL(urlVerificacao, { margin: 0, width: 220 });
      doc.addImage(qrDataUrl, "PNG", 129, finalY + 9, 20, 20);
    } catch {
      // se o QR falhar por qualquer motivo, o token abaixo ainda garante a verificação manual
    }

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(80, 80, 80);
    doc.text("Código de autenticação:", 152, finalY + 11);
    doc.setFont("courier", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(20, 20, 20);
    const tokenLinhas = doc.splitTextToSize(autenticacao.token.toUpperCase(), 40);
    doc.text(tokenLinhas, 152, finalY + 15);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Emitido: ${new Date(autenticacao.dataEmissao).toLocaleString("pt-BR")}`, 152, finalY + 24);

    doc.setFontSize(5.3);
    doc.setTextColor(120, 120, 120);
    doc.text(`Hash: ${autenticacao.hash.slice(0, 16)}...`, 152, finalY + 28);
    doc.text("Confira em /verificar", 152, finalY + 32);
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...vermelho);
    doc.text("SELO PENDENTE", 161, finalY + 12, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(120, 120, 120);
    doc.text("Não foi possível emitir a", 161, finalY + 19, { align: "center" });
    doc.text("autenticação agora. Gere o", 161, finalY + 23, { align: "center" });
    doc.text("PDF novamente para tentar de novo.", 161, finalY + 27, { align: "center", maxWidth: 62 });
  }

  let y2 = finalY + alturaBoxes + 8;
  if (inspecao.observacoes) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(30, 30, 30);
    doc.text("Observações", 14, y2);
    y2 += 6;
    doc.setFont("helvetica", "normal");
    const obsLinhas = doc.splitTextToSize(inspecao.observacoes, 180);
    doc.text(obsLinhas, 14, y2);
  }

  // Rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Documento gerado pelo FireControl OS em ${new Date().toLocaleString("pt-BR")}`,
    14,
    pageHeight - 10
  );

  const nomeArquivo = `inspecao-${equipamento?.codigo_interno ?? inspecao.id}-${new Date(
    inspecao.created_at
  )
    .toISOString()
    .slice(0, 10)}.pdf`;
  doc.save(nomeArquivo);
}
