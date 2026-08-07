"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

/**
 * Leitor de QR Code usando a câmera do celular. Reconhece dois tipos de
 * código gerados pelo próprio FireControl OS:
 *  - Etiqueta de equipamento → /equipamentos/[id]
 *  - Selo de autenticidade de um PDF (inspeção ou diagnóstico) → /verificar/[token]
 *
 * Qualquer outro QR (de outro site, por exemplo) é mostrado cru, com a
 * opção de abrir mesmo assim — sem navegar automaticamente pra fora do
 * FireControl OS sem confirmação.
 */
export default function ScannerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);

  const [erro, setErro] = useState<string | null>(null);
  const [resultadoBruto, setResultadoBruto] = useState<string | null>(null);
  const [pausado, setPausado] = useState(false);

  useEffect(() => {
    let cancelado = false;

    async function iniciarCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelado) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        tick();
      } catch (err) {
        setErro(
          "Não foi possível acessar a câmera. Verifique se você autorizou o navegador a usar a câmera do celular."
        );
        console.error("[scanner] falha ao acessar câmera:", err);
      }
    }

    function tick() {
      if (cancelado) return;
      const video = videoRef.current;
      const canvas = canvasRef.current;

      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const codigo = jsQR(imageData.data, imageData.width, imageData.height);
          if (codigo?.data) {
            processarLeitura(codigo.data);
            return; // pausa o loop até o usuário decidir o que fazer
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    iniciarCamera();

    return () => {
      cancelado = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function processarLeitura(valor: string) {
    setPausado(true);
    setResultadoBruto(valor);

    try {
      const url = new URL(valor, window.location.origin);
      const mesmoOrigin = url.origin === window.location.origin;

      if (mesmoOrigin && /^\/equipamentos\/[^/]+$/.test(url.pathname)) {
        router.push(url.pathname);
        return;
      }
      if (mesmoOrigin && /^\/verificar\/[^/]+$/.test(url.pathname)) {
        router.push(url.pathname);
        return;
      }
    } catch {
      // não é uma URL válida — mostra o valor cru pro usuário decidir
    }
  }

  function tentarDeNovo() {
    setPausado(false);
    setResultadoBruto(null);
    setErro(null);
    rafRef.current = requestAnimationFrame(function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const codigo = jsQR(imageData.data, imageData.width, imageData.height);
          if (codigo?.data) {
            processarLeitura(codigo.data);
            return;
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    });
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="font-display text-2xl mb-1">Escanear QR Code</h1>
      <p className="text-sm text-brand-slate/60 mb-4">
        Aponte a câmera para a etiqueta de um equipamento ou para o selo de um laudo em PDF.
      </p>

      {erro && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3 mb-4">
          {erro}
        </div>
      )}

      <div className="relative bg-black rounded-lg overflow-hidden aspect-square">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <canvas ref={canvasRef} className="hidden" />
        {!pausado && (
          <div className="absolute inset-8 border-2 border-white/70 rounded-lg pointer-events-none" />
        )}
      </div>

      {pausado && resultadoBruto && (
        <div className="mt-4 bg-white border border-black/10 rounded-md p-4">
          <p className="text-sm font-medium mb-1">QR Code não reconhecido pelo FireControl OS</p>
          <p className="text-xs text-brand-slate/60 break-all mb-3">{resultadoBruto}</p>
          <div className="flex gap-2">
            <button
              onClick={tentarDeNovo}
              className="bg-brand-red text-white text-xs px-3 py-1.5 rounded-md hover:bg-brand-redDark transition"
            >
              Escanear de novo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
