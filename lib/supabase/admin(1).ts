import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cliente Supabase com a service role key — ignora RLS.
 * Uso restrito a contextos 100% server-side (Route Handlers, Server
 * Components): NUNCA importe isso de um arquivo "use client", e nunca
 * envie essa chave para o navegador. Serve para a página pública de
 * verificação de selo (/verificar), que precisa ler a inspeção sem o
 * visitante estar logado no sistema.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY não configurada. Copie a 'service_role key' em Project Settings > API no Supabase e defina essa variável no servidor (.env.local / Vercel)."
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
