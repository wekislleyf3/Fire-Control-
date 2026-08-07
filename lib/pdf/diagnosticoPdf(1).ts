import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Cliente } from "@/types/cliente";
import { enderecoCompleto } from "@/types/cliente";
import type { DiagnosticoCliente } from "@/lib/diagnostico";
import { faixaDoIfc } from "@/lib/ifc";
import { desenharSeloAutenticidade, type AutenticacaoLaudo } from "@/lib/pdf/seloAutenticidade";
import { baixarPdf } from "@/lib/pdf/baixarPdf";
import { CORES, desenharCabecalho, desenharRodape, desenharCardInfo } from "@/lib/pdf/documentoBase";

export type { AutenticacaoLaudo };

const AMARELO: [number, number, number] = [180, 120, 10];
const AMARELO_CLARO: [number, number, number] = [255, 251, 235];

/** Gera e baixa (no navegador) o PDF de diagnóstico inicial de um cliente. */
export async function gerarDiagnosticoPdf(
  cliente: Cliente,
  diagnostico: DiagnosticoCliente,
  autenticacao: AutenticacaoLaudo | null
) {
  const doc = new jsPDF();
  const numeroDocumento = (cliente.matricula ?? cliente.id.slice(0, 8)).toUpperCase();
  const hojeFmt = new Date().toLocaleDateString("pt-BR");

  let y = desenharCabecalho(doc, {
    tituloDocumento: "Diagnóstico de Conformidade",
    numeroDocumento,
    dataDocumento: hojeFmt,
  });

  const documentoPessoa =
    cliente.tipo_pessoa === "fisica" ? { rotulo: "CPF", valor: cliente.cpf } : { rotulo: "CNPJ", valor: cliente.cnpj };
  const cidadeUf = [cliente.cidade, cliente.estado].filter(Boolean).join("/");

  y = desenharCardInfo(doc, y, [
    [{ label: "Empresa", valor: cliente.razao_social }, { label: "Matrícula", valor: cliente.matricula ?? "—" }],
    [{ label: documentoPessoa.rotulo, valor: documentoPessoa.valor ?? "—" }, { label: "Cidade/UF", valor: cidadeUf || "—" }],
    [{ label: "Endereço", valor: enderecoCompleto(cliente) || "—" }],
  ]);
  y += 8;

  // Cartões de resumo numérico (equipamentos / conformes / pendências / IFC)
  const faixa = faixaDoIfc(diagnostico.ifc.score);
  const corIfc: [number, number, number] =
    diagnostico.ifc.score >= 85 ? CORES.verde : diagnostico.ifc.score >= 70 ? AMARELO : CORES.vermelho;

  const stats: { label: string; valor: string; destaque?: boolean; cor?: [number, number, number] }[] = [
    { label: "Equipamentos", valor: String(diagnostico.totalEquipamentos) },
    { label: "Conformes", valor: String(diagnostico.equipamentosConformes) },
    { label: "Pendências", valor: String(diagnostico.equipamentosPendentes) },
    { label: "IFC", valor: `${diagnostico.ifc.score}%`, destaque: true, cor: corIfc },
  ];

  const larguraTotal = 182;
  const gap = 4;
  const larguraCard = (larguraTotal - gap * 3) / 4;
  const alturaCard = 22;

  stats.forEach((stat, i) => {
    const x = 14 + i * (larguraCard + gap);
    doc.setFillColor(...(stat.destaque ? ([255, 255, 255] as [number, number, number]) : CORES.fundoCard));
    doc.setDrawColor(...(stat.cor ?? CORES.borda));
    doc.setLineWidth(stat.destaque ? 0.6 : 0.3);
    doc.roundedRect(x, y, larguraCard, alturaCard, 2, 2, "FD");

    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...CORES.tintaClara);
    doc.text(stat.label.toUpperCase(), x + larguraCard / 2, y + 6.5, { align: "center" });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(stat.destaque ? 15 : 13);
    doc.setTextColor(...(stat.cor ?? CORES.tinta));
    doc.text(stat.valor, x + larguraCard / 2, y + 16.5, { align: "center" });
  });

  y += alturaCard + 6;

  if (diagnostico.ifc.score < 70) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(7.5);
    doc.setTextColor(...CORES.tintaClara);
    doc.text(`Classificação: ${faixa.label} — recomenda-se atenção prioritária.`, 14, y);
    y += 6;
  }

  // Principais problemas
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...CORES.tinta);
  doc.text("Principais pendências identificadas", 14, y);
  y += 4;

  if (diagnostico.problemas.length === 0) {
    doc.setFillColor(...CORES.verdeClaro);
    doc.setDrawColor(...CORES.borda);
    doc.roundedRect(14, y, 182, 14, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...CORES.verde);
    doc.text("✓ Nenhuma pendência encontrada — cliente em conformidade.", 20, y + 9);
    y += 22;
  } else {
    autoTable(doc, {
      startY: y + 2,
      head: [["Pendência"]],
      body: diagnostico.problemas.slice(0, 15).map((p) => [p.descricao]),
      headStyles: { fillColor: CORES.tinta, textColor: 255, fontSize: 9, fontStyle: "bold" },
      styles: { fontSize: 9, cellPadding: { top: 3.5, right: 3, bottom: 3.5, left: 3 }, textColor: CORES.tinta },
      alternateRowStyles: { fillColor: CORES.fundoCard },
      didParseCell: (data) => {
        if (data.section === "body") {
          const problema = diagnostico.problemas[data.row.index];
          data.cell.styles.textColor = problema?.severidade === "vencido" ? CORES.vermelho : AMARELO;
          data.cell.styles.fontStyle = "bold";
        }
      },
    });
    // @ts-expect-error — lastAutoTable é injetado pelo plugin jspdf-autotable
    y = (doc.lastAutoTable?.finalY ?? y + 20) + 8;
  }

  // Selo de autenticidade — mesmo mecanismo (token + hash) usado no laudo
  // de inspeção (ver lib/pdf/seloAutenticidade.ts). O hash aqui cobre os
  // dados BRUTOS dos equipamentos/documentos do cliente (não a lista de
  // problemas com contagem de dias, que mudaria sozinha com o tempo) —
  // ver lib/documentoHash.ts para o porquê disso importar.
  await desenharSeloAutenticidade(doc, autenticacao, { x: 14, y, largura: 70, altura: 42 });

  desenharRodape(doc, numeroDocumento);

  baixarPdf(doc, `diagnostico-${cliente.matricula ?? cliente.id}.pdf`);
}
