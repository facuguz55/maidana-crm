-- Campo unread en contacts para saber si hay mensajes sin ver
alter table public.contacts
  add column if not exists unread boolean not null default false;
