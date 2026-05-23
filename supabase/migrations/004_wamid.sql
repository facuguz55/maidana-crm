-- wamid: ID único de WhatsApp para deduplicar mensajes
-- Permite capturar outbound del webhook sin duplicar los ya guardados por send-message
alter table public.messages
  add column if not exists wamid text;

create unique index if not exists messages_wamid_unique
  on public.messages (wamid)
  where wamid is not null;
