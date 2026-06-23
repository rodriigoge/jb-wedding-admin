# J&B Wedding Admin

Painel privado para os noivos acompanharem as confirmações de presença do site de casamento.

## Stack

- Next.js
- React.js
- TypeScript
- Autenticação por e-mail e senha
- Banco de dados remoto

## Como rodar

```bash
npm install
npm run dev
```

Depois acesse:

```text
http://localhost:3000
```

## Configuração

As variáveis ficam no arquivo `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://ziyjazqtbxnumvqhlnte.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sua-publishable-key
SUPABASE_SECRET_KEY=sua-secret-key
```

A chave privada é server-only e não deve ser usada em componentes client-side.

## Login

O login usa e-mail e senha. Crie os usuários dos noivos na área de autenticação do painel da base:

```text
Authentication > Users
```

Para que o usuário autenticado consiga ver a lista, o e-mail dele também precisa estar cadastrado na tabela `admin_users`, conforme o script SQL da base.

Se a landing page salva as confirmações, mas o admin mostra lista vazia, execute também:

```text
supabase/admin-access-fix.sql
```

Esse script corrige as permissões para que o usuário autenticado consiga consultar `rsvp_confirmations` quando o e-mail estiver cadastrado em `admin_users`.

## O que já existe

- Login real com e-mail e senha.
- Dashboard consultando `rsvp_confirmations` por uma API server-side protegida.
- Exclusão de confirmações pelo painel admin.
- Busca por nome, telefone e observação.
- Filtros por status.
- Exportação da lista filtrada em CSV.
- Redirecionamento para `/login` quando não existe sessão ativa.

## WhatsApp

O endpoint `POST /api/notify-whatsapp` envia uma mensagem para o WhatsApp dos noivos quando configurado com a API oficial do WhatsApp.

Variáveis necessárias no ambiente de deploy:

```env
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_TO=5535992046991
WHATSAPP_API_VERSION=v20.0
LANDING_ORIGIN=https://dominio-da-landing.com
NOTIFICATION_WEBHOOK_SECRET=uma-chave-interna
```

Você pode integrar de duas formas:

1. Configurar um webhook de banco para chamar esse endpoint em todo `INSERT` na tabela `rsvp_confirmations`.
2. Fazer a landing chamar esse endpoint depois que a confirmação for salva.

Para o webhook, envie o header:

```text
x-webhook-secret: valor-da-NOTIFICATION_WEBHOOK_SECRET
```

## Próxima etapa

Conectar o formulário da landing page à mesma tabela `rsvp_confirmations`, usando a chave pública e a permissão pública de insert.
