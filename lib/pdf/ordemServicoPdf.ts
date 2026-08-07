import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cliente } from "@/types/cliente";
import { enderecoCompleto } from "@/types/cliente";
import type { OrdemServico } from "@/types/ordemServico";
import { TIPO_OS_LABEL } from "@/types/ordemServico";
import { baixarPdf } from "@/lib/pdf/baixarPdf";
import { desenharSeloAutenticidade, type AutenticacaoLaudo } from "@/lib/pdf/seloAutenticidade";
import { CORES, desenharCabecalho, desenharRodape, desenharCardInfo } from "@/lib/pdf/documentoBase";

export type { AutenticacaoLaudo };

/**
 * Gera e baixa (no navegador) o PDF de uma Ordem de Serviço. Duas variantes:
 * "vistoria" lista os equipamentos já cadastrados a vistoriar por
 * localização; "levantamento" é usada em clientes na fase inicial, sem
 * equipamentos cadastrados ainda, então não traz tabela de itens. Nos dois
 * casos, se já coletada, imprime a assinatura do cliente — serve como
 * comprovante de que a visita foi realizada.
 *
 * `autenticacao` deve vir do endpoint POST /api/laudos/emitir (mesmo
 * mecanismo usado nos laudos de inspeção): QR + token verificáveis em
 * /verificar/[token], com hash HMAC-SHA256 do conteúdo da OS.
 */
export async function gerarOrdemServicoPdf(
  os: OrdemServico,
  cliente: Cliente | undefined,
  autenticacao: AutenticacaoLaudo | null
) {
  const doc = new jsPDF();
  const numeroDocumento = `OS-${String(os.numero).padStart(5, "0")}`;
  const dataFmt = new Date(os.data + "T00:00:00").toLocaleDateString("pt-BR");
  const isLevantamento = os.tipo === "levantamento";

  let y = desenharCabecalho(doc, {
    tituloDocumento: isLevantamento ? "Ordem de Serviço — Levantamento de Equipamentos" : "Ordem de Serviço",
    numeroDocumento,
    dataDocumento: dataFmt,
  });

  const cidadeUf = cliente ? [cliente.cidade, cliente.estado].filter(Boolean).join("/") : "";

  y = desenharCardInfo(doc, y, [
    [{ label: "Cliente", valor: cliente?.razao_social ?? "—" }, { label: "Cidade/UF", valor: cidadeUf || "—" }],
    [{ label: "Endereço", valor: cliente ? enderecoCompleto(cliente) : "—" }, { label: "Data da visita", valor: dataFmt }],
    [
      { label: "Técnico responsável", valor: os.responsavel_tecnico ?? "—" },
      { label: "Tipo", valor: TIPO_OS_LABEL[os.tipo] },
    ],
  ]);
  y += 8;

  let finalY: number;

  if (isLevantamento) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CORES.tinta);
    doc.text("Levantamento / cadastro de equipamentos", 14, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CORES.tintaClara);
    const texto = doc.splitTextToSize(
      "Visita realizada para levantamento inicial das instalações e cadastro dos equipamentos de combate a " +
        "incêndio do cliente. O detalhamento dos equipamentos identificados será registrado no cadastro do " +
        "cliente após esta visita.",
      180
    );
    doc.text(texto, 14, y);
    finalY = y + texto.length * 4.5 + 8;
  } else {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CORES.tinta);
    doc.text("Equipamentos a vistoriar", 14, y);
    y += 4;

    const itens = os.itens ?? [];
    const linhas = itens.map((item) => [
      item.codigo_interno_snapshot ?? "—",
      item.tipo_equipamento_snapshot ?? "—",
      item.localizacao_snapshot ?? "—",
      item.verificado ? "Verificado" : "Pendente",
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Código", "Tipo", "Localização", "Situação"]],
      body: linhas,
      headStyles: { fillColor: CORES.tinta, textColor: 255, fontSize: 9, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: { top: 4, right: 3, bottom: 4, left: 3 }, textColor: CORES.tinta },
      alternateRowStyles: { fillColor: CORES.fundoCard },
      columnStyles: { 0: { cellWidth: 32 }, 1: { cellWidth: 40 }, 2: { cellWidth: 70 }, 3: { cellWidth: 30, halign: "center" } },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          data.cell.styles.textColor = data.cell.raw === "Verificado" ? CORES.verde : CORES.tintaClara;
          if (data.cell.raw === "Verificado") data.cell.styles.fontStyle = "bold";
        }
      },
    });

    // @ts-expect-error — lastAutoTable é injetado pelo plugin jspdf-autotable
    finalY = (doc.lastAutoTable?.finalY ?? y + 20) + 8;
  }

  if (os.observacoes) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...CORES.tinta);
    doc.text("Observações", 14, finalY);
    finalY += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...CORES.tintaClara);
    const obsLinhas = doc.splitTextToSize(os.observacoes, 180);
    doc.text(obsLinhas, 14, finalY);
    finalY += obsLinhas.length * 4.5 + 8;
  }

  // Bloco de assinatura do cliente (esquerda) + selo de autenticidade
  // (direita), lado a lado — mesmo layout usado no laudo de inspeção. O
  // selo garante que o conteúdo da OS não foi adulterado depois de emitido
  // (ver lib/documentoHash.ts).
  const alturaBloco = 40;
  if (finalY + alturaBloco + 15 > doc.internal.pageSize.getHeight()) {
    doc.addPage();
    finalY = 20;
  }

  const alturaLinhaAssinatura = 26;
  doc.setDrawColor(...CORES.borda);
  doc.setLineWidth(0.4);
  doc.line(14, finalY + alturaLinhaAssinatura, 100, finalY + alturaLinhaAssinatura);

  if (os.assinatura_cliente_url) {
    try {
      doc.addImage(os.assinatura_cliente_url, "PNG", 14, finalY, 86, alturaLinhaAssinatura - 4);
    } catch {
      // se a imagem falhar ao carregar, segue só com a linha em branco
    }
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...CORES.tintaClara);
  const nomeAssinante = os.assinatura_nome ? `${os.assinatura_nome} — assinatura do cliente` : "Assinatura do cliente";
  doc.text(nomeAssinante, 14, finalY + alturaLinhaAssinatura + 5);
  if (os.assinatura_data) {
    doc.text(`Coletada em ${new Date(os.assinatura_data).toLocaleString("pt-BR")}`, 14, finalY + alturaLinhaAssinatura + 10);
  }

  await desenharSeloAutenticidade(doc, autenticacao, { x: 126, y: finalY, largura: 70, altura: alturaBloco });

  desenharRodape(doc, numeroDocumento);

  const nomeArquivo = `os-${os.numero}-${cliente?.razao_social?.slice(0, 20) ?? os.cliente_id}-${os.data}.pdf`;
  baixarPdf(doc, nomeArquivo);
}
