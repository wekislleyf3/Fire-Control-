# FireControl OS — MVP Fase 1

Scaffold inicial: Next.js + Supabase (Postgres/Auth/Storage), custo **R$ 0/mês** no início.

## O que já vem pronto
- **Login obrigatório** (Supabase Auth) — todas as rotas são protegidas, exceto `/login`
- Dashboard com indicadores (clientes ativos, equipamentos, vencidos, vencendo em breve)
- Módulo Clientes (listar + cadastrar)
- Módulo Equipamentos (listar + cadastrar + gerar QR Code)
- Módulo Inspeções (checklist, histórico automático, atualização de status)
- Schema completo do banco (`supabase/schema.sql`) cobrindo clientes, unidades, equipamentos,
  histórico, documentos, inspeções, contratos e alertas — pronto pros próximos módulos

## Como colocar no ar de graça (passo a passo)

### 1. Criar o banco (Supabase — grátis)
1. Crie uma conta em supabase.com e um novo projeto (escolha a região São Paulo).
2. Vá em **SQL Editor > New query**, cole o conteúdo de `supabase/schema.sql` e rode.
3. Em **Project Settings > API**, copie a **Project URL** e a **anon public key**.

### 2. Criar seu usuário de login (Supabase — grátis)
1. Vá em **Authentication > Users > Add user**.
2. Cadastre seu e-mail e uma senha. Marque "Auto Confirm User" pra não precisar confirmar por e-mail.
3. Esse é o login que você vai usar em `/login` no sistema.

### 3. Ativar as políticas de acesso
1. Vá em **SQL Editor > New query**, cole o conteúdo de `supabase/policies.sql` e rode.
   (Isso reativa o RLS e libera acesso só pra quem estiver logado.)

### 3.1. Configurar upload de fotos e documentos (Storage — grátis)
1. Vá em **Storage > New bucket**, nomeie como `firecontrol-files` e marque **Public bucket**.
2. Vá em **SQL Editor > New query**, cole o conteúdo de `supabase/storage_policies.sql` e rode.

### 3.2. Ativar o Índice FireControl (IFC)
1. Vá em **SQL Editor > New query**, cole o conteúdo de `supabase/migration_ifc.sql` e rode.
   (Cria a tabela de histórico mensal do índice.)

### 4. Rodar localmente (opcional, pra testar)
```bash
npm install
cp .env.example .env.local   # cole a URL e a anon key do Supabase
npm run dev
```
Abra http://localhost:3000

### 5. Subir pro ar (Vercel — grátis)
1. Crie um repositório no GitHub e suba esta pasta (`git init`, `git add .`, `git commit`, `git push`).
2. Crie uma conta em vercel.com, clique em **New Project** e importe o repositório.
3. Em **Environment Variables**, adicione `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Clique em Deploy. Em ~1 minuto o sistema estará no ar em algo como `firecontrol-os.vercel.app`.

Nenhum desses passos exige cartão de crédito nos planos free do Supabase e da Vercel.

## Próximos passos sugeridos (na ordem)
1. Upload de fotos e documentos (Supabase Storage)
2. Alertas automáticos (função agendada — Supabase Edge Function + cron)
3. Relatórios em PDF
