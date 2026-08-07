import jsPDF from "jspdf";
import QRCode from "qrcode";
import type { Equipamento } from "@/types/equipamento";
import { baixarPdf } from "@/lib/pdf/baixarPdf";

export type TamanhoEtiqueta = "pequena" | "media" | "grande";

const TAMANHOS: Record<TamanhoEtiqueta, { largura: number; altura: number }> = {
  pequena: { largura: 50, altura: 35 },
  media: { largura: 80, altura: 56 },
  grande: { largura: 110, altura: 75 },
};

/**
 * Gera uma etiqueta (PDF) com QR Code apontando para a página do
 * equipamento dentro do FireControl OS. A ideia é imprimir isso numa
 * etiqueta adesiva resistente e colar no próprio equipamento (extintor,
 * mangueira, etc.) — quando o técnico escaneia em campo, o sistema já
 * reconhece de qual equipamento se trata e abre a página dele.
 *
 * O QR aponta pro UUID do equipamento (`eq.id`), não pro código interno
 * digitado por alguém — assim o link nunca quebra mesmo que o código
 * interno seja editado depois.
 *
 * `tamanho` escolhe entre 3 tamanhos prontos (não depende de nenhuma
 * etiqueta adesiva específica — todo o layout escala proporcionalmente).
 */
export async function gerarEtiquetaEquipamento(equipamento: Equipamento, tamanho: TamanhoEtiqueta = "media") {
  const { largura: W, altura: H } = TAMANHOS[tamanho];
  // Fator de escala em relação ao tamanho "média" (80x56), usado como referência de layout.
  const s = W / 80;

  const doc = new jsPDF({ unit: "mm", format: [W, H] });
  const vermelho: [number, number, number] = [196, 30, 30];

  const url = `${typeof window !== "undefined" ? window.location.origin : ""}/equipamentos/${equipamento.id}`;

  doc.setFillColor(...vermelho);
  doc.rect(0, 0, W, 9 * s, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9 * s);
  doc.text("FireControl OS", 4 * s, 6 * s);

  const qrTamanho = 32 * s;
  try {
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 0, width: 260 });
    doc.addImage(qrDataUrl, "PNG", 4 * s, 13 * s, qrTamanho, qrTamanho);
  } catch (err) {
    console.error("[etiqueta] falha ao gerar QR Code:", err);
    doc.setTextColor(...vermelho);
    doc.setFontSize(7 * s);
    doc.text("Erro ao gerar QR", 4 * s, 25 * s);
  }

  const colunaTexto = 40 * s;
  const larguraTexto = W - colunaTexto - 2;

  doc.setTextColor(20, 20, 20);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11 * s);
  doc.text(equipamento.codigo_interno, colunaTexto, 18 * s, { maxWidth: larguraTexto });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8 * s);
  doc.setTextColor(80, 80, 80);
  doc.text(equipamento.tipo, colunaTexto, 24 * s, { maxWidth: larguraTexto });

  if (equipamento.localizacao) {
    const localLinhas = doc.splitTextToSize(equipamento.localizacao, larguraTexto);
    doc.text(localLinhas, colunaTexto, 30 * s);
  }

  doc.setFontSize(6.5 * s);
  doc.setTextColor(120, 120, 120);
  doc.text("Escaneie para ver o", 4 * s, H - 7 * s);
  doc.text("equipamento e inspecionar.", 4 * s, H - 3.5 * s);

  baixarPdf(doc, `etiqueta-${equipamento.codigo_interno}.pdf`);
}
