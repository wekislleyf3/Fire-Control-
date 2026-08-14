import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

// ============================================================
// FireControl OS — Webhook Instagram Messaging API
// Rota: app/api/webhook/instagram/route.ts
// ============================================================

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN!;
const APP_SECRET = process.env.INSTAGRAM_APP_SECRET!; // usado para validar assinatura
const IG_ACCESS_TOKEN = process.env.INSTAGRAM_ACCESS_TOKEN!;
const GRAPH_VERSION = "v21.0";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role: precisa bypassar RLS aqui
);

// ------------------------------------------------------------
// GET — Verificação do webhook (Meta chama isso 1x ao configurar)
// ------------------------------------------------------------
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN && challenge) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

// ------------------------------------------------------------
// POST — Recebe eventos de mensagem
// ------------------------------------------------------------
export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  console.log("📩 Webhook recebido, body bruto:", rawBody);

  // Validação de assinatura (recomendado pela Meta, evita chamadas falsas)
  const signature = req.headers.get("x-hub-signature-256");
  const signatureOk = verifySignature(rawBody, signature);
  console.log("🔐 Assinatura recebida:", signature, "| válida?", signatureOk);
  if (!signatureOk) {
    console.error("❌ Assinatura inválida — requisição rejeitada");
    return new NextResponse("Invalid signature", { status: 401 });
  }

  const body = JSON.parse(rawBody);
  console.log("📦 Body parseado, object:", body.object, "| entries:", body.entry?.length ?? 0);

  try {
    if (body.object === "instagram") {
      for (const entry of body.entry ?? []) {
        console.log("➡️ Processando entry:", entry.id, "| messaging events:", entry.messaging?.length ?? 0);
        for (const event of entry.messaging ?? []) {
          console.log("💬 Evento bruto:", JSON.stringify(event));

          // Ignora eco de mensagens enviadas pelo próprio bot
          if (event.message?.is_echo) {
            console.log("↩️ Ignorado: é eco de mensagem do próprio bot");
            continue;
          }

          const senderId = event.sender?.id;
          const text = event.message?.text?.trim();
          console.log("🔎 senderId:", senderId, "| text:", text);

          if (senderId && text) {
            console.log("✅ Chamando handleIncomingMessage...");
            await handleIncomingMessage(senderId, text);
          } else if (senderId && event.message && !text) {
            console.log("🖼️ Mensagem sem texto (mídia) — respondendo fallback");
            // Lead mandou áudio, figurinha, imagem etc. — não deixa no vácuo
            await sendMessage(
              senderId,
              "Não consegui entender esse tipo de mensagem 🙏 pode responder em texto?"
            );
          } else {
            console.log("⚠️ Evento ignorado: sem senderId/text utilizável (pode ser 'read', 'delivery' etc.)");
          }
        }
      }
    } else {
      console.log("⚠️ body.object não é 'instagram':", body.object);
    }
    // Meta exige resposta 200 rápida, senão desativa o webhook
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (err) {
    console.error("Erro no webhook do Instagram:", err);
    // Ainda retorna 200 para não fazer a Meta reenviar o mesmo evento indefinidamente
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  }
}

// ------------------------------------------------------------
// Valida a assinatura HMAC enviada pela Meta
// ------------------------------------------------------------
function verifySignature(rawBody: string, signatureHeader: string | null) {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", APP_SECRET).update(rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(expected)
    );
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// Máquina de estados simples da qualificação do lead
// steps: 0 = boas-vindas, 1 = tipo estabelecimento, 2 = área construída,
//        3 = status do alvará, 4 = concluído
// ------------------------------------------------------------
async function handleIncomingMessage(senderId: string, text: string) {
  const { data: conversa } = await supabase
    .from("instagram_conversas")
    .select("*")
    .eq("ig_user_id", senderId)
    .maybeSingle();

  if (!conversa) {
    // Primeira mensagem do lead
    await supabase.from("instagram_conversas").insert({
      ig_user_id: senderId,
      step: 1,
    });
    await sendMessage(
      senderId,
      "Olá! 👋 Sou o assistente virtual da FireControl. Vou te fazer 3 perguntas rápidas para entender sua necessidade de conformidade com o Corpo de Bombeiros (CBMES). Seus dados serão usados apenas para elaborar seu orçamento e entrar em contato — nada de spam.\n\nPara começar: qual o tipo do seu estabelecimento? (ex: comércio, indústria, escola, condomínio...)"
    );
    return;
  }

  switch (conversa.step) {
    case 1:
      await supabase
        .from("instagram_conversas")
        .update({ tipo_estabelecimento: text, step: 2 })
        .eq("ig_user_id", senderId);
      await sendMessage(
        senderId,
        "Perfeito! E qual a área construída aproximada do imóvel (em m²)?"
      );
      break;

    case 2:
      await supabase
        .from("instagram_conversas")
        .update({ area_construida: text, step: 3 })
        .eq("ig_user_id", senderId);
      await sendMessage(
        senderId,
        "Certo. E sobre o Alvará do Corpo de Bombeiros (ou Declaração de Dispensa):\n\n1️⃣ Já tenho e está ativo\n2️⃣ Está vencido ou vencendo\n3️⃣ Nunca tive / não sei\n\nResponda com o número da opção."
      );
      break;

    case 3:
      await supabase
        .from("instagram_conversas")
        .update({ status_alvara: text, step: 4 })
        .eq("ig_user_id", senderId);

      // Grava o lead qualificado na tabela comercial existente
      await supabase.from("leads_site").insert({
        origem: "instagram_dm",
        ig_user_id: senderId,
        tipo_estabelecimento: conversa.tipo_estabelecimento,
        area_construida: conversa.area_construida,
        status_alvara: text,
        criado_em: new Date().toISOString(),
      });

      await sendMessage(
        senderId,
        "Obrigado! ✅ Já registramos suas informações. Nossa equipe vai analisar e entrar em contato para te passar os próximos passos rumo à conformidade com o CBMES. 🚒"
      );
      break;

    default:
      // Conversa já concluída — resposta padrão
      await sendMessage(
        senderId,
        "Já recebemos seus dados! Em breve nossa equipe entra em contato. Se quiser adiantar algo, pode escrever aqui mesmo. 🙂"
      );
  }
}

// ------------------------------------------------------------
// Envia mensagem via Instagram Send API
// ------------------------------------------------------------
async function sendMessage(recipientId: string, text: string) {
  const url = `https://graph.instagram.com/${GRAPH_VERSION}/me/messages?access_token=${IG_ACCESS_TOKEN}`;
  console.log("📤 Enviando mensagem para:", recipientId, "| texto:", text);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error("❌ Erro ao enviar mensagem Instagram:", res.status, errBody);
  } else {
    console.log("✅ Mensagem enviada com sucesso, status:", res.status);
  }
}	

