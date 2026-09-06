create table if not exists public.dioni_documentos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references public.dioni_clientes(id) on delete cascade,
  nome_original text not null,
  caminho_storage text not null unique,
  tipo_mime text not null,
  tamanho bigint not null check (tamanho > 0 and tamanho <= 15728640),
  created_at timestamptz not null default now()
);

create index if not exists dioni_documentos_cliente_idx
  on public.dioni_documentos (cliente_id, created_at desc);

alter table public.dioni_documentos enable row level security;

grant usage on schema public to anon, authenticated, service_role;
grant select, insert, update, delete on table public.dioni_documentos to anon, authenticated, service_role;

insert into storage.buckets (id, name, public, file_size_limit)
values ('dioni-documentos', 'dioni-documentos', false, 15728640)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit;

notify pgrst, 'reload schema';
