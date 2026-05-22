-- Tabla contacts
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  phone text unique not null,
  name text,
  status text not null default 'nuevo' check (status in ('nuevo','frio','caliente','verificar_pago','pagado')),
  first_contact_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  last_message_preview text,
  notes text,
  created_at timestamptz not null default now()
);

-- Tabla orders
create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  name text not null,
  phone text not null,
  address text not null,
  quantity integer not null,
  status text not null default 'pendiente' check (status in ('pendiente','verificado','enviado')),
  created_at timestamptz not null default now()
);

-- Tabla messages
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid references public.contacts(id) on delete cascade,
  body text not null,
  direction text not null check (direction in ('inbound','outbound')),
  timestamp timestamptz not null default now()
);

-- Tabla settings
create table if not exists public.settings (
  id integer primary key default 1,
  evolution_api_url text not null default '',
  evolution_api_key text not null default '',
  instance_name text not null default ''
);

insert into public.settings (id) values (1) on conflict do nothing;

-- Habilitar Realtime en contacts
alter publication supabase_realtime add table public.contacts;

-- RLS (Row Level Security)
alter table public.contacts enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.settings enable row level security;

-- Políticas: solo usuarios autenticados
create policy "authenticated users can do everything" on public.contacts
  for all using (auth.role() = 'authenticated');

create policy "authenticated users can do everything" on public.orders
  for all using (auth.role() = 'authenticated');

create policy "authenticated users can do everything" on public.messages
  for all using (auth.role() = 'authenticated');

create policy "authenticated users can do everything" on public.settings
  for all using (auth.role() = 'authenticated');

-- Service role puede insertar desde webhook
create policy "service role can insert contacts" on public.contacts
  for insert with check (true);

create policy "service role can update contacts" on public.contacts
  for update using (true);
