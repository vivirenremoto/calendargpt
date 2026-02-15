-- Ejecuta este script en Supabase SQL Editor para permitir que la app web
-- (sin login) pueda crear, leer y borrar notas.

create extension if not exists pgcrypto;

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  note_date date not null,
  content text not null check (char_length(content) <= 160),
  created_at timestamptz not null default now()
);

alter table public.notes enable row level security;

-- Políticas para uso público (anon key). Para un entorno productivo,
-- lo ideal es usar autenticación y políticas por usuario.
drop policy if exists "anon can read notes" on public.notes;
create policy "anon can read notes"
on public.notes for select
to anon
using (true);

drop policy if exists "anon can insert notes" on public.notes;
create policy "anon can insert notes"
on public.notes for insert
to anon
with check (true);

drop policy if exists "anon can delete notes" on public.notes;
create policy "anon can delete notes"
on public.notes for delete
to anon
using (true);
