export const ENTITLEMENT_WRITER='imagem-em-lote';

export async function installEntitlementGuard(client){
  // One migration statement: the triggers and the audit table become visible together.
  const execute=typeof client.exec==='function'?client.exec.bind(client):client.query.bind(client);
  await execute(`
    create table if not exists image_sync_entitlement_audit (
      id bigint generated always as identity primary key,
      changed_at timestamptz not null default clock_timestamp(),
      application_name text not null, actor text not null, table_name text not null,
      operation text not null, before_state jsonb, after_state jsonb
    );
    create or replace function image_sync_guard_entitlement() returns trigger
    language plpgsql as $guard$
    declare
      writer text := current_setting('application_name',true);
      before_state jsonb;
      after_state jsonb;
    begin
      if writer is distinct from 'imagem-em-lote' then
        raise exception 'Entitlement writes must go through Imagem em Lote' using errcode='42501';
      end if;
      if TG_WHEN='AFTER' then
        if TG_OP <> 'INSERT' then before_state := to_jsonb(OLD) - 'evidence'; end if;
        if TG_OP <> 'DELETE' then after_state := to_jsonb(NEW) - 'evidence'; end if;
        if before_state is distinct from after_state then
          insert into image_sync_entitlement_audit(application_name,actor,table_name,operation,before_state,after_state)
            values(writer,session_user,TG_TABLE_NAME,TG_OP,before_state,after_state);
        end if;
        return null;
      end if;
      if TG_OP='DELETE' then return OLD; end if;
      return NEW;
    end;
    $guard$;
    create or replace trigger image_sync_entitlement_guard before insert or update or delete on image_sync_access
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_guard before insert or update or delete on image_sync_monthly
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_guard before insert or update or delete on image_sync_native_receipts
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_guard before insert or update or delete on image_sync_partner_receipts
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_history after insert or update or delete on image_sync_access
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_history after insert or update or delete on image_sync_monthly
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_history after insert or update or delete on image_sync_native_receipts
      for each row execute function image_sync_guard_entitlement();
    create or replace trigger image_sync_entitlement_history after insert or update or delete on image_sync_partner_receipts
      for each row execute function image_sync_guard_entitlement();
  `);
}
