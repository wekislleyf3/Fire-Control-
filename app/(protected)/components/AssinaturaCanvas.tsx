"use client";

import { useRef, useState } from "react";

type Props = {
  /** Chamado sempre que o traço muda, com um PNG base64 ou null se estiver vazio. */
  onChange: (dataUrl: string | null) => void;
};

/**
 * Campo de assinatura simples: o cliente assina com o dedo (touch) ou
 * mouse direto na tela do técnico, e o traço vira um PNG (data URL) que
 * é enviado pra cima via onChange. Sem libs externas — só canvas nativo.
 */
export default function AssinaturaCanvas({ onChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const desenhando = useRef(false);
  const [vazio, setVazio] = useState(true);

  function posicao(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const ponto = "touches" in e ? e.touches[0] : e;
    return {
      x: ((ponto.clientX - rect.left) / rect.width) * canvas.width,
      y: ((ponto.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  function iniciar(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    desenhando.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicao(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function mover(e: React.MouseEvent | React.TouchEvent) {
    if (!desenhando.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = posicao(e);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#1E293B";
    ctx.lineTo(x, y);
    ctx.stroke();
    if (vazio) setVazio(false);
  }

  function finalizar() {
    if (!desenhando.current) return;
    desenhando.current = false;
    const canvas = canvasRef.current!;
    onChange(vazio ? null : canvas.toDataURL("image/png"));
  }

  function limpar() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setVazio(true);
    onChange(null);
  }

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={500}
        height={180}
        className="w-full h-[180px] bg-white border border-black/15 rounded-lg touch-none cursor-crosshair"
        onMouseDown={iniciar}
        onMouseMove={mover}
        onMouseUp={finalizar}
        onMouseLeave={finalizar}
        onTouchStart={iniciar}
        onTouchMove={mover}
        onTouchEnd={finalizar}
      />
      <div className="flex items-center justify-between mt-1.5">
        <p className="text-[11px] text-brand-slate/50">Assine com o dedo ou o mouse na área acima.</p>
        <button type="button" onClick={limpar} className="text-xs text-brand-red underline">
          limpar
        </button>
      </div>
    </div>
  );
}
