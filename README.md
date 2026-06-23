# J&B Wedding Admin

Painel privado para os noivos acompanharem as confirmações de presença do site de casamento.

## Stack

- Next.js
- React.js
- TypeScript
- Supabase Auth
- Supabase Database

## Como rodar

```bash
npm install
npm run dev
```

Depois acesse:

```text
http://localhost:3000
```

## Supabase

As variáveis ficam no arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ziyjazqtbxnumvqhlnte.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-publishable-key
SUPABASE_SECRET_KEY=sua-secret-key
```

A `SUPABASE_SECRET_KEY` é server-only e não deve ser usada em componentes client-side.

## Login

O login usa Supabase Auth com e-mail e senha. Crie os usuários dos noivos no painel do Supabase em:

```text
Authentication > Users
```

Para que o usuário autenticado consiga ver a lista, o e-mail dele também precisa estar cadastrado na tabela `admin_users`, conforme o script SQL da base.

Se a landing page salva as confirmações, mas o admin mostra lista vazia, execute também:

```text
supabase/admin-access-fix.sql
```

Esse script corrige as policies para que o usuário autenticado consiga consultar `rsvp_confirmations` quando o e-mail estiver cadastrado em `admin_users`.

## O que já existe

- Login real com Supabase Auth.
- Dashboard consultando `rsvp_confirmations` por uma API server-side protegida.
- Busca por nome, telefone e observação.
- Filtros por status.
- Exportação da lista filtrada em CSV.
- Redirecionamento para `/login` quando não existe sessão ativa.

## Próxima etapa

Conectar o formulário da landing page à mesma tabela `rsvp_confirmations`, usando a publishable key e a policy pública de insert.
