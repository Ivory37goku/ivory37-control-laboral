-- Prueba transaccional: no conservar usuarios ni datos ficticios.
begin;
set local statement_timeout = '15s';
insert into auth.users(id,email,aud,role) values
('5efa1b4b-dbd5-4b42-aec0-65ca790dd941','audit-a@example.invalid','authenticated','authenticated'),
('89b59ddd-67f3-457f-a88a-3b4585becab0','audit-b@example.invalid','authenticated','authenticated');
set local role authenticated;
select set_config('request.jwt.claim.sub','5efa1b4b-dbd5-4b42-aec0-65ca790dd941',true);
insert into public.ivory37_sync(user_id,payload) values ('5efa1b4b-dbd5-4b42-aec0-65ca790dd941','{"audit":"a"}');
insert into public.gestion_clientes(user_id,payload) values ('5efa1b4b-dbd5-4b42-aec0-65ca790dd941','{"audit":"a"}');
select set_config('request.jwt.claim.sub','89b59ddd-67f3-457f-a88a-3b4585becab0',true);
insert into public.ivory37_sync(user_id,payload) values ('89b59ddd-67f3-457f-a88a-3b4585becab0','{"audit":"b"}');
insert into public.gestion_clientes(user_id,payload) values ('89b59ddd-67f3-457f-a88a-3b4585becab0','{"audit":"b"}');
do $test$
declare tbl text; owner_id uuid; other_id uuid; n bigint;
begin
 foreach owner_id in array array['5efa1b4b-dbd5-4b42-aec0-65ca790dd941'::uuid,'89b59ddd-67f3-457f-a88a-3b4585becab0'::uuid] loop
  other_id := case when owner_id='5efa1b4b-dbd5-4b42-aec0-65ca790dd941' then '89b59ddd-67f3-457f-a88a-3b4585becab0'::uuid else '5efa1b4b-dbd5-4b42-aec0-65ca790dd941'::uuid end;
  perform set_config('request.jwt.claim.sub',owner_id::text,true);
  foreach tbl in array array['ivory37_sync','gestion_clientes'] loop
   execute format('select count(*) from public.%I where user_id in ($1,$2)',tbl) into n using owner_id,other_id;
   if n<>1 then raise exception 'RLS SELECT falló: %',tbl; end if;
   execute format('update public.%I set payload=''{"audit":"blocked"}'' where user_id=$1',tbl) using other_id;
   get diagnostics n=row_count;
   if n<>0 then raise exception 'RLS UPDATE ajeno falló: %',tbl; end if;
   execute format('update public.%I set payload=''{"audit":"own"}'' where user_id=$1',tbl) using owner_id;
   get diagnostics n=row_count;
   if n<>1 then raise exception 'UPDATE propio falló: %',tbl; end if;
   begin
    execute format('insert into public.%I(user_id,payload) values ($1,''{}'')',tbl) using other_id;
    raise exception 'INSERT ajeno permitido: %',tbl;
   exception when insufficient_privilege then null; end;
   begin
    execute format('update public.%I set user_id=''b42e46b2-791f-47ef-9b08-5690f3767e28'' where user_id=$1',tbl) using owner_id;
    raise exception 'Transferencia de propietario permitida: %',tbl;
   exception when insufficient_privilege then null; end;
   begin
    execute format('delete from public.%I where user_id=$1',tbl) using owner_id;
    raise exception 'DELETE no autorizado permitido: %',tbl;
   exception when insufficient_privilege then null; end;
  end loop;
 end loop;
end $test$;
reset role;
set local role anon;
do $test$
declare tbl text;
begin
 foreach tbl in array array['ivory37_sync','gestion_clientes'] loop
  begin
   execute format('select user_id from public.%I limit 0',tbl);
   raise exception 'Acceso anónimo permitido: %',tbl;
  exception when insufficient_privilege then null; end;
 end loop;
end $test$;
reset role;
rollback;
select 'PASS: 24 comprobaciones authenticated + 2 anon; transacción revertida' as resultado;
