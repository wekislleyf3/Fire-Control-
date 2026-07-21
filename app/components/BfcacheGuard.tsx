"use client";

import { useEffect } from "react";

/**
 * Ao usar o botão "voltar" do navegador/celular, o Chrome/Safari costumam
 * restaurar a página inteira de uma memória local (bfcache) em vez de pedir
 * dados novos ao servidor — isso valia tanto pro Dashboard quanto pras
 * páginas de Clientes/Equipamentos, porque o navegador simplesmente "descongela"
 * a página do jeito que estava antes, sem rodar nada de novo.
 * Esse componente força um recarregamento nesse caso específico.
 */
export default function BfcacheGuard() {
  useEffect(() => {
    function handlePageShow(event: PageTransitionEvent) {
      if (event.persisted) {
        window.location.reload();
      }
    }
    window.addEventListener("pageshow", handlePageShow);
    return () => window.removeEventListener("pageshow", handlePageShow);
  }, []);

  return null;
}
