import type jsPDF from "jspdf";
import QRCode from "qrcode";
import { CORES, truncarTexto } from "@/lib/pdf/documentoBase";

export type AutenticacaoLaudo = {
  token: string;
  hash: string;
  dataEmissao: string;
};

/**
 * Desenha a caixa de selo de autenticidade (QR + token + hash) em
 * qualquer PDF do FireControl OS. Usado por todos os geradores de PDF —
 * inspeção, diagnóstico, e qualquer documento futuro (ex: Ordem de
 * Serviço) — pra garantir que todos tenham exatamente o mesmo mecanismo
 * de autenticação, sem duplicar o desenho em cada arquivo.
 *
 * Layout em lista (label em cima, valor embaixo, empilhado) — mais fácil
 * de ler que tudo espremido numa linha só.
 *
 * Nunca deixa a caixa em branco: qualquer falha (QR, token malformado
 * etc.) cai num estado visível com o motivo impresso, em vez de sumir
 * silenciosamente — inclusive pra quem só tem o celular pra depurar.
 */
export async function desenharSeloAutenticidade(
  doc: jsPDF,
  autenticacao: AutenticacaoLaudo | null,
  caixa: { x: number; y: number; largura: number; altura: number }
): Promise<void> {
  const { x, y, largura, altura } = caixa;
  const centroX = x + largura / 2;

  doc.setDrawColor(...CORES.borda);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(x, y, largura, altura, 2, 2, "FD");

  if (!autenticacao) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...CORES.vermelho);
    doc.text("SELO PENDENTE", centroX, y + altura / 2 - 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...CORES.tintaClara);
    const linhas = doc.splitTextToSize(
      "Não foi possível emitir a autenticação agora. Gere o PDF novamente para tentar de novo.",
      largura - 10
    );
    doc.text(linhas, centroX, y + altura / 2 + 1, { align: "center", lineHeightFactor: 1.4 });
    return;
  }

  try {
    // O glifo Unicode ✓ não existe nas fontes padrão do jsPDF (helvetica/
    // times/courier usam WinAnsiEncoding) — quando o glifo não é encontrado,
    // o jsPDF quebra o mapeamento de caracteres da linha inteira, causando
    // espaçamento estranho e a impressão de "vazamento" da caixa. Por isso o
    // check é desenhado como vetor, separado do texto, em vez de caractere.
    const textoTitulo = "DOCUMENTO AUTENTICADO";
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const larguraTitulo = doc.getTextWidth(textoTitulo);
    const larguraCheck = 3.4; // largura ocupada pelo ícone de check
    const gapCheckTexto = 2;
    const larguraGrupo = larguraCheck + gapCheckTexto + larguraTitulo;

    // Ponto de partida do grupo inteiro (check + texto), centralizado na caixa
    const inicioGrupoX = centroX - larguraGrupo / 2;
    const checkX = inicioGrupoX;
    const textoX = inicioGrupoX + larguraCheck + gapCheckTexto;

    doc.setDrawColor(...CORES.verde);
    doc.setLineWidth(0.7);
    doc.setLineCap("round");
    doc.setLineJoin("round");
    doc.line(checkX, y + 6.2, checkX + 1.3, y + 7.5);
    doc.line(checkX + 1.3, y + 7.5, checkX + larguraCheck, y + 4.7);

    doc.setTextColor(...CORES.verde);
    doc.text(textoTitulo, textoX, y + 7, { align: "left" });

    doc.setDrawColor(...CORES.borda);
    doc.setLineWidth(0.2);
    doc.line(x + 5, y + 10, x + largura - 5, y + 10);

    const urlVerificacao = `${
      typeof window !== "undefined" ? window.location.origin : ""
    }/verificar/${encodeURIComponent(autenticacao.token)}`;

    const qrTamanho = 22;
    const qrX = x + 5;
    const qrY = y + 14;
    try {
      const qrDataUrl = await QRCode.toDataURL(urlVerificacao, { margin: 0, width: 220 });
      doc.addImage(qrDataUrl, "PNG", qrX, qrY, qrTamanho, qrTamanho);
    } catch (qrErr) {
      console.error("[selo] falha ao gerar QR Code:", qrErr);
      // se o QR falhar, o token abaixo ainda garante a verificação manual
    }

    // Lista label/valor empilhada, ao lado do QR.
    const colX = qrX + qrTamanho + 4;
    const larguraCol = x + largura - colX - 3;
    let ly = y + 15;

    const campo = (label: string, valor: string, mono = true) => {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.6);
      doc.setTextColor(...CORES.tintaSuave);
      doc.text(label.toUpperCase(), colX, ly);
      ly += 3.4;

      doc.setFont(mono ? "courier" : "helvetica", "bold");
      doc.setFontSize(mono ? 6 : 6.5);
      doc.setTextColor(...CORES.tinta);
      doc.text(truncarTexto(doc, valor, larguraCol), colX, ly);
      ly += 5.2;
    };

    // Só o token e a data vão impressos. O hash de integridade não tem
    // utilidade nenhuma pra quem lê o papel (a verificação acontece via
    // QR/token em /verificar, nunca comparando hash a olho) e imprimi-lo
    // só expõe, sem necessidade, que existe um mecanismo HMAC por trás —
    // informação que não deveria vazar pra fora do sistema.
    campo("Código", autenticacao.token.toUpperCase().slice(0, 13) + "...");
    campo("Emitido", new Date(autenticacao.dataEmissao).toLocaleDateString("pt-BR"), false);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.6);
    doc.setTextColor(...CORES.tintaSuave);
    doc.text("VERIFICAÇÃO", colX, ly);
    ly += 3.4;
    doc.setFontSize(6);
    doc.setTextColor(...CORES.vermelho);
    doc.text("/verificar", colX, ly);
  } catch (err) {
    console.error("[selo] falha ao desenhar o selo autenticado, token recebido foi:", autenticacao, err);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...CORES.vermelho);
    doc.text("ERRO AO EXIBIR SELO", centroX, y + altura / 2 - 4, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(...CORES.tintaClara);
    const motivo = err instanceof Error ? err.message : String(err);
    const motivoLinhas = doc.splitTextToSize(motivo, largura - 8);
    doc.text(motivoLinhas, centroX, y + altura / 2 + 1, { align: "center", lineHeightFactor: 1.4 });
  }
}
