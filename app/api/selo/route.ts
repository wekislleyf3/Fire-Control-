import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { gerarCodigoSelo } from "@/lib/selo";

export const dynamic = "force-dynamic";

/**
 * POST /api/selo
 * Body: { inspecaoId: string }
 *
 * Emite o código de verificação (selo) de uma inspeção, se ainda não tiver
 * um. Só usuários autenticados do FireControl OS podem chamar essa rota —
 * a assinatura HMAC em si roda inteiramente no servidor (lib/selo.ts), com
 * a chave secreta guardada só em variável de ambiente, então o código não
 * pode ser forjado por quem só tem acesso ao PDF final ou ao app no
 * navegador.
 */
export async function POST(request: Request) {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const inspecaoId = body?.inspecaoId;

  if (!inspecaoId || typeof inspecaoId !== "string") {
    return NextResponse.json({ error: "inspecaoId é obrigatório." }, { status: 400 });
  }

  const { data: inspecao, error: fetchError } = await supabase
    .from("inspecoes")
    .select("id, created_at, codigo_verificacao")
    .eq("id", inspecaoId)
    .single();

  if (fetchError || !inspecao) {
    return NextResponse.json({ error: "Inspeção não encontrada." }, { status: 404 });
  }

  // Já tem selo emitido — devolve o mesmo, o selo de um documento não muda.
  if (inspecao.codigo_verificacao) {
    return NextResponse.json({ codigo: inspecao.codigo_verificacao });
  }

  let codigo: string;
  try {
    codigo = gerarCodigoSelo({
      tabela: "inspecoes",
      id: inspecao.id,
      createdAt: inspecao.created_at,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  const { error: updateError } = await supabase
    .from("inspecoes")
    .update({ codigo_verificacao: codigo })
    .eq("id", inspecaoId);

  if (updateError) {
    return NextResponse.json({ error: `Erro ao salvar selo: ${updateError.message}` }, { status: 500 });
  }

  return NextResponse.json({ codigo });
}
