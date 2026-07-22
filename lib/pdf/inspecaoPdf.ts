import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cliente } from "@/types/cliente";
import { enderecoCompleto } from "@/types/cliente";
import type { Equipamento } from "@/types/equipamento";
import type { Inspecao } from "@/types/inspecao";
import { getChecklistParaTipo } from "@/lib/checklists";

/** Gera e baixa (no navegador) o PDF de uma inspeção já registrada. */
export function gerarInspecaoPdf(
  inspecao: Inspecao,
  cliente: Cliente | undefined,
  equipamento: Equipamento | undefined
) {
  const doc = new jsPDF();
  const vermelho: [number, number, number] = [196, 30, 30];
  const cinza: [number, number, number] = [90, 90, 90];

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(...vermelho);
  doc.text("FireControl OS", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(...cinza);
  doc.text("Relatório de Inspeção Técnica", 14, 25);

  doc.setDrawColor(225, 225, 225);
  doc.line(14, 29, 196, 29);

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
  const finalY = (doc.lastAutoTable?.finalY ?? y + 20) + 10;

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  if (inspecao.resultado === "conforme") {
    doc.setTextColor(30, 130, 76);
    doc.text("RESULTADO GERAL: CONFORME", 14, finalY);
  } else {
    doc.setTextColor(...vermelho);
    doc.text("RESULTADO GERAL: NÃO CONFORME", 14, finalY);
  }

  let y2 = finalY + 10;
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
