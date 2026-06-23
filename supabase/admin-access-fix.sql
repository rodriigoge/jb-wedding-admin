-- Correção das policies do painel admin.
-- Execute este script no Supabase SQL Editor.

-- A função abaixo evita que a policy de rsvp_confirmations dependa de uma
-- leitura direta em admin_users bloqueada pelo próprio RLS da tabela.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(admin_users.email) = lower(auth.jwt() ->> 'email')
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.admin_users enable row level security;
alter table public.rsvp_confirmations enable row level security;

drop policy if exists "Admins can read admin users" on public.admin_users;
drop policy if exists "Admins can read RSVP confirmations" on public.rsvp_confirmations;
drop policy if exists "Admins can update RSVP confirmations" on public.rsvp_confirmations;
drop policy if exists "Admins can delete RSVP confirmations" on public.rsvp_confirmations;

create policy "Admins can read admin users"
on public.admin_users
for select
to authenticated
using (public.is_admin());

create policy "Admins can read RSVP confirmations"
on public.rsvp_confirmations
for select
to authenticated
using (public.is_admin());

create policy "Admins can update RSVP confirmations"
on public.rsvp_confirmations
for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Admins can delete RSVP confirmations"
on public.rsvp_confirmations
for delete
to authenticated
using (public.is_admin());

-- Confirme que o e-mail usado no login do Supabase Auth está cadastrado aqui.
-- Troque pelo e-mail real dos noivos, se necessário.
-- insert into public.admin_users (email)
-- values ('email-dos-noivos@example.com')
-- on conflict (email) do nothing;
