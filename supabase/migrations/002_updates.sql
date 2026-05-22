-- Nuevos campos en settings
alter table public.settings
  add column if not exists google_sheets_id text not null default '',
  add column if not exists sheet_name text not null default 'Respuestas de formulario 1',
  add column if not exists google_api_key text not null default '',
  add column if not exists form_message text not null default '';

-- form_timestamp único en orders para evitar duplicados
alter table public.orders
  add column if not exists form_timestamp text unique;

-- Habilitar realtime en messages
alter publication supabase_realtime add table public.messages;

-- RLS messages ya existe, agregar política service role
create policy "service role full access messages" on public.messages
  for all using (true) with check (true);
