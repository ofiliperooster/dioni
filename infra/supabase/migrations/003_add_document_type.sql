alter table public.dioni_documentos
  add column if not exists tipo_documento text not null default 'Outros';

alter table public.dioni_documentos
  drop constraint if exists dioni_documentos_tipo_documento_check;

alter table public.dioni_documentos
  add constraint dioni_documentos_tipo_documento_check
  check (tipo_documento in ('CPF', 'RG', 'CNH', 'Contrato', 'Outros'));

notify pgrst, 'reload schema';
