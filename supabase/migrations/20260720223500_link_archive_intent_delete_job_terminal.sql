create or replace function public.mcp_sync_archive_intent_from_delete_job()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'completed' then
    update public.mcp_archive_intents
       set status = 'completed',
           response_status = coalesce(response_status, 200),
           response_payload = coalesce(
             response_payload,
             jsonb_build_object(
               'targetId', target_id,
               'deleteJobId', new.id,
               'deleted', true
             )
           ),
           last_error = null,
           completed_at = coalesce(completed_at, now()),
           updated_at = now()
     where installation_id = new.installation_id
       and delete_job_id = new.id
       and status <> 'completed';
  elsif new.status = 'failed' then
    update public.mcp_archive_intents
       set status = 'failed',
           last_error = left(coalesce(new.last_error, 'archive_failed'), 500),
           completed_at = null,
           updated_at = now()
     where installation_id = new.installation_id
       and delete_job_id = new.id
       and status <> 'completed';
  end if;
  return new;
end;
$function$;

drop trigger if exists mcp_storage_delete_jobs_sync_archive_intent
  on public.mcp_storage_delete_jobs;
create trigger mcp_storage_delete_jobs_sync_archive_intent
after update of status, last_error, completed_at
on public.mcp_storage_delete_jobs
for each row
when (old.status is distinct from new.status or old.last_error is distinct from new.last_error)
execute function public.mcp_sync_archive_intent_from_delete_job();

revoke all on function public.mcp_sync_archive_intent_from_delete_job()
  from public, anon, authenticated;
