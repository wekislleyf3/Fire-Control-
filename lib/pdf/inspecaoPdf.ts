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

  // Parecer técnico
  doc.setDrawColor(...(aprovado ? verde : vermelho));
  doc.setFillColor(...(aprovado ? verdeClaro : vermelhoClaro));
  doc.roundedRect(14, finalY, 118, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(aprovado ? verde : vermelho));
  doc.text(`PARECER: ${aprovado ? "EQUIPAMENTO CONFORME" : "NÃO CONFORMIDADE DETECTADA"}`, 18, finalY + 8, {
    maxWidth: 110,
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
    { maxWidth: 108 }
  );

  // Selo de vistoria virtual
  doc.setDrawColor(...vermelho);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(136, finalY, 60, 26, 2, 2, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...vermelho);
  doc.text("SELO DE VISTORIA VIRTUAL", 166, finalY + 7, { align: "center" });

  doc.setFont("courier", "bold");
  doc.setFontSize(7);
  doc.setTextColor(60, 60, 60);
  doc.text(inspecao.id.toUpperCase().slice(0, 16), 166, finalY + 14, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text("FIRECONTROL OS VERIFIED", 166, finalY + 20, { align: "center" });

  let y2 = finalY + 34;
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
