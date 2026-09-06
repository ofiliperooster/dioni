create table if not exists public.dioni_clientes (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  documento text not null unique check (documento ~ '^[0-9]{11}([0-9]{3})?$'),
  data_nascimento date not null,
  endereco text not null,
  dia_vencimento smallint not null check (dia_vencimento between 1 and 31),
  status text not null default 'Pagando' check (status in ('Cancelado', 'Pagando', 'Quitado')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists dioni_clientes_status_idx on public.dioni_clientes (status);
create index if not exists dioni_clientes_dia_vencimento_idx on public.dioni_clientes (dia_vencimento);

alter table public.dioni_clientes enable row level security;

comment on table public.dioni_clientes is 'Cadastros de clientes da aplicação Dioni';
comment on column public.dioni_clientes.documento is 'CPF ou CNPJ armazenado somente com números';
