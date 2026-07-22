import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cliente } from "@/types/cliente";
import { enderecoCompleto } from "@/types/cliente";
import type { DiagnosticoCliente } from "@/lib/diagnostico";
import { faixaDoIfc } from "@/lib/ifc";

/** Gera e baixa (no navegador) o PDF de diagnóstico inicial de um cliente. */
export function gerarDiagnosticoPdf(cliente: Cliente, diagnostico: DiagnosticoCliente) {
  const doc = new jsPDF();
  const vermelho: [number, number, number] = [196, 30, 30];
  const cinza: [number, number, number] = [90, 90, 90];
  const verde: [number, number, number] = [30, 130, 76];
  const amarelo: [number, number, number] = [180, 120, 10];

  // Cabeçalho
  doc.setFontSize(18);
  doc.setTextColor(...vermelho);
  doc.text("FireControl OS", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(...cinza);
  doc.text("Diagnóstico de Conformidade", 14, 25);

  doc.setDrawColor(225, 225, 225);
  doc.line(14, 29, 196, 29);

  let y = 38;
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);

  doc.setFont("helvetica", "bold");
  doc.text("Empresa", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(cliente.razao_social, 40, y);

  doc.setFont("helvetica", "bold");
  doc.text("Matrícula", 140, y);
  doc.setFont("helvetica", "normal");
  doc.text(cliente.matricula ?? "—", 168, y);
  y += 6;

  const documento =
    cliente.tipo_pessoa === "fisica" ? { rotulo: "CPF", valor: cliente.cpf } : { rotulo: "CNPJ", valor: cliente.cnpj };
  doc.setFont("helvetica", "bold");
  doc.text(documento.rotulo, 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(documento.valor ?? "—", 40, y);
  y += 6;

  const endereco = enderecoCompleto(cliente);
  doc.setFont("helvetica", "bold");
  doc.text("Endereço", 14, y);
  doc.setFont("helvetica", "normal");
  const enderecoLinhas = doc.splitTextToSize(endereco || "—", 145);
  doc.text(enderecoLinhas, 40, y);
  y += 6 * enderecoLinhas.length + 4;

  doc.setFont("helvetica", "bold");
  doc.text("Data do diagnóstico", 14, y);
  doc.setFont("helvetica", "normal");
  doc.text(new Date().toLocaleDateString("pt-BR"), 50, y);
  y += 10;

  // Resumo numérico
  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 11, cellPadding: 2 },
    body: [
      ["Equipamentos analisados", String(diagnostico.totalEquipamentos)],
      ["Em conformidade", String(diagnostico.equipamentosConformes)],
      ["Pendências", String(diagnostico.equipamentosPendentes)],
      ["IFC (Índice FireControl)", `${diagnostico.ifc.score}%`],
    ],
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
  });

  // @ts-expect-error — lastAutoTable é injetado pelo plugin jspdf-autotable
  let finalY = (doc.lastAutoTable?.finalY ?? y + 30) + 4;

  // Selo de nota (IFC) com cor conforme faixa
  const faixa = faixaDoIfc(diagnostico.ifc.score);
  const corRgb: [number, number, number] =
    diagnostico.ifc.score >= 90 ? verde : diagnostico.ifc.score >= 75 ? amarelo : vermelho;
  doc.setDrawColor(...corRgb);
  doc.setLineWidth(0.6);
  doc.roundedRect(140, finalY - 32, 56, 30, 2, 2, "S");
  doc.setFontSize(9);
  doc.setTextColor(...cinza);
  doc.text("Nota FireControl", 168, finalY - 24, { align: "center" });
  doc.setFontSize(20);
  doc.setTextColor(...corRgb);
  doc.setFont("helvetica", "bold");
  doc.text(`${diagnostico.ifc.score}`, 168, finalY - 11, { align: "center" });
  doc.setFontSize(9);
  doc.text(faixa.label, 168, finalY - 5, { align: "center" });

  finalY += 4;
  doc.setDrawColor(225, 225, 225);
  doc.line(14, finalY, 196, finalY);
  finalY += 8;

  // Principais problemas
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 30, 30);
  doc.text("Principais problemas identificados", 14, finalY);
  finalY += 4;

  if (diagnostico.problemas.length === 0) {
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...verde);
    doc.text("Nenhuma pendência encontrada — cliente em conformidade.", 14, finalY + 6);
  } else {
    autoTable(doc, {
      startY: finalY + 2,
      head: [["Problema"]],
      body: diagnostico.problemas.slice(0, 15).map((p) => [`• ${p.descricao}`]),
      headStyles: { fillColor: vermelho, textColor: 255, fontSize: 9 },
      styles: { fontSize: 9, cellPadding: 2.5 },
      didParseCell: (data) => {
        if (data.section === "body") {
          const problema = diagnostico.problemas[data.row.index];
          data.cell.styles.textColor = problema?.severidade === "vencido" ? vermelho : amarelo;
        }
      },
    });
  }

  // Rodapé
  const pageHeight = doc.internal.pageSize.getHeight();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Diagnóstico gerado pelo FireControl OS em ${new Date().toLocaleString("pt-BR")}`,
    14,
    pageHeight - 10
  );

  doc.save(`diagnostico-${cliente.matricula ?? cliente.id}.pdf`);
}
