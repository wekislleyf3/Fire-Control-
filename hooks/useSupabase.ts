"use client";

import { useMemo } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Hook para obter o client do Supabase em Client Components.
 * Substitui o padrão antigo de `const supabase = createClient()` solto
 * no topo de cada arquivo — agora fica centralizado e memoizado por
 * instância de componente.
 */
export function useSupabase() {
  return useMemo(() => createClient(), []);
}
