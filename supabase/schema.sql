-- Auror-Agenda : une ligne par cliente, son journal entier en JSON.
-- À coller une fois dans Supabase → SQL Editor → Run.

create table if not exists public.journals (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Chaque cliente ne voit et ne modifie que son propre journal.
alter table public.journals enable row level security;

create policy "lire son journal" on public.journals
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "créer son journal" on public.journals
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "modifier son journal" on public.journals
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "supprimer son journal" on public.journals
  for delete to authenticated using ((select auth.uid()) = user_id);

revoke all on public.journals from anon;
grant select, insert, update, delete on public.journals to authenticated;

-- L'heure de mise à jour est posée par le serveur (pas par l'horloge du téléphone).
create or replace function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists journals_touch on public.journals;
create trigger journals_touch before insert or update on public.journals
  for each row execute function public.touch_updated_at();
