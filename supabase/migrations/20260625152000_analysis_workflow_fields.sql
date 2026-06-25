alter table public.analyses
  add column if not exists workflow_stage text,
  add column if not exists sofer_batch_id text,
  add column if not exists sofer_transcription_id text,
  add column if not exists sofer_client_item_id text,
  add column if not exists report_payload jsonb,
  add column if not exists workflow_error text;

create index if not exists analyses_sofer_batch_id_idx
  on public.analyses (sofer_batch_id)
  where sofer_batch_id is not null;