# FireControl OS — MVP Fase 1

Scaffold inicial: Next.js + Supabase (Postgres/Auth/Storage), custo **R$ 0/mês** no início.

## O que já vem pronto
- Dashboard com indicadores (clientes ativos, equipamentos, vencidos, vencendo em breve)
- Módulo Clientes (listar + cadastrar)
- Módulo Equipamentos (listar + cadastrar + gerar QR Code)
- Schema completo do banco (`supabase/schema.sql`) cobrindo clientes, unidades, equipamentos,
  histórico, documentos, inspeções, contratos e alertas — pronto pros próximos módulos

## Como colocar no ar de graça (passo a passo)

### 1. Criar o banco (Supabase — grátis)
1. Crie uma conta em supabase.com e um novo projeto (escolha a região São Paulo).
2. Vá em **SQL Editor > New query**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.

### 2. Rodar localmente (opcional, pra testar)
```bash
npm install
cp .env.example .env.local   # cole a URL e a anon key do Supabase
npm run dev
```
Abra http://localhost:3000

### 3. Subir pro ar (Vercel — grátis)
1. Crie um repositório no GitHub e suba esta pasta (`git init`, `git add .`, `git commit`, `git push`).
2. Crie uma conta em vercel.com, clique em **New Project** e importe o repositório.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Clique em Deploy. Em ~1 minuto o sistema estará no ar em algo como `firecontrol-os.vercel.app`.

Nenhum desses passos exige cartão de crédito nos planos free do Supabase e da Vercel.

## Próximos passos sugeridos (na ordem)
1. Login (Supabase Auth) — hoje o app está aberto, sem tela de login
2. Módulo de Inspeções (checklist)
3. Upload de fotos e documentos (Supabase Storage)
4. Alertas automáticos (função agendada — Supabase Edge Function + cron)
5. Relatórios em PDF
