import type jsPDF from "jspdf";

/**
 * Baixa um PDF já montado, de forma mais confiável entre navegadores do
 * que confiar cegamente em `doc.save()`. Cria o link de download,
 * anexa no DOM antes de clicar (alguns navegadores mobile ignoram o
 * clique em elementos fora do DOM) e limpa depois.
 *
 * Importante: no iOS Safari, TODO download de arquivo pela web abre uma
 * pré-visualização em vez de salvar direto — é uma restrição da Apple,
 * não um bug daqui (acontece em qualquer site). No Android e desktop,
 * essa técnica baixa direto sem precisar confirmar de novo.
 */
export function baixarPdf(doc: jsPDF, nomeArquivo: string) {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = nomeArquivo;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
