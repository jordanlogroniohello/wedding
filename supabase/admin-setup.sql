-- Admin tools for dashboard.html
-- Run in Supabase → SQL Editor. Safe to run again after changes:
-- CHANGE-ME is only used the first time (when no password exists yet).

set search_path = public, extensions;

create extension if not exists pgcrypto with schema extensions;

create table if not exists admin_passwords (
  id serial primary key,
  password_hash text not null,
  created_at timestamptz default now()
);

-- RLS on with no policies: the table can't be read or changed through the public API key.
alter table admin_passwords enable row level security;

insert into admin_passwords (password_hash)
select crypt('CHANGE-ME', gen_salt('bf'))
where not exists (select 1 from admin_passwords);


-- Notes per guest (e.g. souvenir name). Coordinators see them on the dashboard,
-- so anyone can read; only admin_save_guest (password-checked) can write.
-- Don't put anything private in notes.
create table if not exists guest_notes (
  guest_id uuid primary key references guests(id) on delete cascade,
  notes text not null,
  updated_at timestamptz default now()
);
alter table guest_notes enable row level security;
drop policy if exists "Public read guest_notes" on guest_notes;
create policy "Public read guest_notes" on guest_notes for select using (true);


create or replace function admin_check(p_password text)
returns boolean
language sql
security definer
set search_path = public, extensions
as $$
  select exists (
    select 1 from admin_passwords
    where password_hash = crypt(p_password, password_hash)
  );
$$;


-- Older version without notes
drop function if exists admin_save_guest(text, uuid, text, text, text, text, text, text);

create or replace function admin_save_guest(
  p_password text,
  p_id uuid,
  p_guest_id text,
  p_full_name text,
  p_display_name text,
  p_category text,
  p_table_number text,
  p_status text,
  p_notes text default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_id uuid := p_id;
begin
  if not admin_check(p_password) then
    raise exception 'Wrong admin password';
  end if;

  if v_id is null then
    insert into guests (guest_id, full_name, display_name, category, table_number)
    values (p_guest_id, p_full_name, p_display_name, p_category, nullif(p_table_number, ''))
    returning id into v_id;
  else
    -- guest_id is never updated: invitation links using it are already sent
    update guests set
      full_name = p_full_name,
      display_name = p_display_name,
      category = p_category,
      table_number = nullif(p_table_number, '')
    where id = v_id;
    if not found then
      raise exception 'Guest not found';
    end if;
  end if;

  if p_status in ('confirmed', 'declined') then
    update rsvps set attending = (p_status = 'confirmed') where guest_id = v_id;
    if not found then
      insert into rsvps (guest_id, attending) values (v_id, p_status = 'confirmed');
    end if;
  end if;

  -- null = leave notes as they are, '' = clear them
  if p_notes is not null then
    if btrim(p_notes) = '' then
      delete from guest_notes where guest_id = v_id;
    else
      insert into guest_notes (guest_id, notes) values (v_id, p_notes)
      on conflict (guest_id) do update set notes = excluded.notes, updated_at = now();
    end if;
  end if;

  return v_id;
end;
$$;


create or replace function admin_delete_guest(p_password text, p_id uuid)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if not admin_check(p_password) then
    raise exception 'Wrong admin password';
  end if;
  delete from views where guest_id = p_id;
  delete from rsvps where guest_id = p_id;
  delete from checkins where guest_id = p_id;
  delete from guests where id = p_id;
end;
$$;


-- No longer needed: notes are publicly readable now
drop function if exists admin_get_notes(text);


grant execute on function admin_check(text) to anon, authenticated;
grant execute on function admin_save_guest(text, uuid, text, text, text, text, text, text, text) to anon, authenticated;
grant execute on function admin_delete_guest(text, uuid) to anon, authenticated;


-- To change the password later:
-- update admin_passwords set password_hash = extensions.crypt('NEW-PASSWORD', extensions.gen_salt('bf'));
