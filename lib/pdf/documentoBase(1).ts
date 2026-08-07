import type jsPDF from "jspdf";
import { LOGO_BASE64, LOGO_FORMATO } from "@/lib/pdf/logo";

/**
 * Paleta e componentes visuais compartilhados por todos os PDFs do
 * FireControl OS. A ideia de design: vermelho é a cor da marca, mas usado
 * como DESTAQUE (logo, status crítico), não como cor dominante — o corpo
 * do documento usa tons neutros (grafite/cinza), o que costuma ler como
 * mais institucional/sério do que uma página cheia de blocos vermelhos.
 */
export const CORES = {
  tinta: [30, 41, 59] as [number, number, number], // texto principal (slate-800)
  tintaClara: [100, 116, 139] as [number, number, number], // texto secundário (slate-500)
  tintaSuave: [148, 163, 184] as [number, number, number], // legendas (slate-400)
  vermelho: [185, 28, 28] as [number, number, number], // marca / accent / crítico
  verde: [21, 128, 61] as [number, number, number],
  verdeClaro: [240, 253, 244] as [number, number, number],
  fundoCard: [248, 250, 252] as [number, number, number], // slate-50
  borda: [226, 232, 240] as [number, number, number], // slate-200
};

const MARGEM = 14;
const LARGURA_PAGINA = 210;

/**
 * Corta um texto com "..." no final se ele não couber na largura máxima —
 * evita que nomes muito longos (razão social, localização) estourem a
 * caixa/coluna. jsPDF não tem um "numberOfLines"/"ellipsizeMode" pronto
 * como bibliotecas baseadas em React, então isso mede o texto caractere a
 * caractere até caber.
 */
export function truncarTexto(doc: jsPDF, texto: string, larguraMaxima: number): string {
  if (!texto) return texto;
  if (doc.getTextWidth(texto) <= larguraMaxima) return texto;

  const reticencias = "...";
  let cortado = texto;
  while (cortado.length > 1 && doc.getTextWidth(cortado + reticencias) > larguraMaxima) {
    cortado = cortado.slice(0, -1);
  }
  return cortado.trimEnd() + reticencias;
}

/**
 * Cabeçalho padrão: logo mark + nome da empresa à esquerda, tipo/número/
 * data do documento à direita, com uma linha fina separando do conteúdo.
 * Retorna o Y onde o conteúdo do documento deve começar.
 */
export function desenharCabecalho(
  doc: jsPDF,
  params: { tituloDocumento: string; numeroDocumento: string; dataDocumento: string }
): number {
  // Logo real, se já tiver sido cadastrada (ver lib/pdf/logo.ts). Enquanto
  // isso, cai na marca "FC" desenhada como reserva — funciona nos dois casos.
  if (LOGO_BASE64) {
    doc.addImage(LOGO_BASE64, LOGO_FORMATO, MARGEM, 8, 12, 12);
  } else {
    doc.setFillColor(...CORES.vermelho);
    doc.roundedRect(MARGEM, 9, 11, 11, 2.2, 2.2, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("FC", MARGEM + 5.5, 15.9, { align: "center" });
  }

  doc.setTextColor(...CORES.tinta);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14.5);
  doc.text("FireControl", MARGEM + 15, 15.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CORES.tintaClara);
  doc.setFontSize(8.5);
  doc.text("Gestão de Segurança Contra Incêndio", MARGEM + 15, 19.8);

  // Rótulo do tipo de documento (pílula) + número/data à direita
  const tituloLargura = doc.getTextWidth(params.tituloDocumento.toUpperCase()) + 10;
  doc.setDrawColor(...CORES.vermelho);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(LARGURA_PAGINA - MARGEM - tituloLargura, 8.5, tituloLargura, 7, 1.8, 1.8, "FD");
  doc.setTextColor(...CORES.vermelho);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(params.tituloDocumento.toUpperCase(), LARGURA_PAGINA - MARGEM - tituloLargura / 2, 13, {
    align: "center",
  });

  doc.setTextColor(...CORES.tintaClara);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Nº ${params.numeroDocumento}  ·  ${params.dataDocumento}`, LARGURA_PAGINA - MARGEM, 20, {
    align: "right",
  });

  doc.setDrawColor(...CORES.borda);
  doc.setLineWidth(0.4);
  doc.line(MARGEM, 26, LARGURA_PAGINA - MARGEM, 26);

  return 36;
}

/** Rodapé padrão: linha fina + texto discreto + número do documento. */
export function desenharRodape(doc: jsPDF, numeroDocumento: string) {
  const alturaPagina = doc.internal.pageSize.getHeight();
  const y = alturaPagina - 14;

  doc.setDrawColor(...CORES.borda);
  doc.setLineWidth(0.3);
  doc.line(MARGEM, y, LARGURA_PAGINA - MARGEM, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(...CORES.tintaSuave);
  doc.text(`Documento nº ${numeroDocumento} · gerado em ${new Date().toLocaleString("pt-BR")}`, MARGEM, y + 5);
  doc.text("FireControl OS", LARGURA_PAGINA - MARGEM, y + 5, { align: "right" });
}

export type CampoInfo = { label: string; valor: string };

/**
 * Card com fundo neutro contendo pares label/valor em duas colunas — usado
 * pra dados do cliente/equipamento no lugar de texto solto com linhas.
 * Linhas com espaçamento mais generoso (paddingVertical maior) e valores
 * longos são cortados com "..." em vez de estourar a caixa. Retorna o Y
 * logo abaixo do card.
 */
export function desenharCardInfo(doc: jsPDF, y: number, linhas: [CampoInfo, CampoInfo?][]): number {
  const alturaLinha = 9; // mais respiro entre linhas (era 7)
  const altura = linhas.length * alturaLinha + 9;
  const largura = LARGURA_PAGINA - MARGEM * 2;
  const larguraColuna = largura / 2 - 12;

  doc.setFillColor(...CORES.fundoCard);
  doc.setDrawColor(...CORES.borda);
  doc.roundedRect(MARGEM, y, largura, altura, 2, 2, "FD");

  let linhaY = y + 8;
  const colEsquerda = MARGEM + 6;
  const colDireita = MARGEM + largura / 2 + 4;

  for (const [campoA, campoB] of linhas) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...CORES.tintaClara);
    doc.text(campoA.label.toUpperCase(), colEsquerda, linhaY);
    if (campoB) doc.text(campoB.label.toUpperCase(), colDireita, linhaY);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...CORES.tinta);
    doc.text(truncarTexto(doc, campoA.valor || "—", larguraColuna), colEsquerda, linhaY + 5);
    if (campoB) doc.text(truncarTexto(doc, campoB.valor || "—", larguraColuna), colDireita, linhaY + 5);

    linhaY += alturaLinha;
  }

  return y + altura;
}

/**
 * Callout de veredito (parecer/resultado): fundo branco, barra colorida à
 * esquerda, título em destaque + descrição — mais sóbrio que uma caixa
 * inteira preenchida de cor. Corpo do texto usa quebra de linha real
 * (splitTextToSize), não só maxWidth de uma linha.
 */
export function desenharCallout(
  doc: jsPDF,
  params: { x: number; y: number; largura: number; altura: number; positivo: boolean; titulo: string; corpo: string }
) {
  const { x, y, largura, altura, positivo, titulo, corpo } = params;
  const cor = positivo ? CORES.verde : CORES.vermelho;
  const fundo = positivo ? CORES.verdeClaro : ([254, 242, 242] as [number, number, number]);

  doc.setFillColor(...fundo);
  doc.setDrawColor(...CORES.borda);
  doc.roundedRect(x, y, largura, altura, 2, 2, "FD");
  doc.setFillColor(...cor);
  doc.rect(x, y, 1.6, altura, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...cor);
  const tituloLinhas = doc.splitTextToSize(titulo, largura - 12);
  doc.text(tituloLinhas, x + 6, y + 8, { lineHeightFactor: 1.35 });

  const yCorpo = y + 8 + tituloLinhas.length * 4.5 + 3.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...CORES.tintaClara);
  const corpoLinhas = doc.splitTextToSize(corpo, largura - 12);
  doc.text(corpoLinhas, x + 6, yCorpo, { lineHeightFactor: 1.4 });
}
