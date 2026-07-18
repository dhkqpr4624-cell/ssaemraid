-- 쌤퀘스트 공유 퀴즈 테이블 안정화 + 수정/삭제 보안 패치
-- Supabase SQL Editor에서 실행하세요. 기존 데이터는 유지됩니다.

create extension if not exists pgcrypto;

create table if not exists public.shared_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  author_name text,
  grade text not null,
  semester text not null,
  subject text not null,
  unit text not null,
  quiz_data jsonb not null,
  thumbnail_url text,
  upload_password text,
  owner_token text,
  question_count integer not null default 0,
  total_score integer not null default 0,
  report_count integer not null default 0,
  download_count integer not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.shared_quizzes add column if not exists thumbnail_url text;
alter table public.shared_quizzes add column if not exists upload_password text;
alter table public.shared_quizzes add column if not exists owner_token text;
alter table public.shared_quizzes add column if not exists question_count integer not null default 0;
alter table public.shared_quizzes add column if not exists total_score integer not null default 0;
alter table public.shared_quizzes add column if not exists report_count integer not null default 0;
alter table public.shared_quizzes add column if not exists download_count integer not null default 0;
alter table public.shared_quizzes add column if not exists is_hidden boolean not null default false;

-- 기존 공유 퀴즈의 목록용 메타데이터를 quiz_data에서 한 번 채웁니다.
update public.shared_quizzes
set
  question_count = coalesce(nullif((quiz_data #>> '{metadata,totalQuestions}'), '')::integer, jsonb_array_length(coalesce(quiz_data->'questions', '[]'::jsonb)), 0),
  total_score = coalesce(nullif((quiz_data #>> '{metadata,totalScore}'), '')::integer, 0),
  thumbnail_url = coalesce(thumbnail_url, quiz_data #>> '{metadata,thumbnailUrl}')
where question_count = 0 or total_score = 0 or thumbnail_url is null;

-- 목록/검색 페이지에서 quiz_data 전체를 읽지 않고 빠르게 조회하기 위한 인덱스입니다.
create index if not exists shared_quizzes_curriculum_idx
  on public.shared_quizzes (grade, semester, subject, unit, is_hidden, created_at desc);

create index if not exists shared_quizzes_visible_created_idx
  on public.shared_quizzes (is_hidden, created_at desc);

create index if not exists shared_quizzes_download_idx
  on public.shared_quizzes (download_count desc, created_at desc);

create index if not exists shared_quizzes_report_idx
  on public.shared_quizzes (report_count desc, created_at desc);

create index if not exists shared_quizzes_text_search_idx
  on public.shared_quizzes using gin (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(author_name, ''))
  );

alter table public.shared_quizzes enable row level security;

-- 기존의 지나치게 넓은 update/delete 정책을 제거합니다.
drop policy if exists "shared quizzes visible select" on public.shared_quizzes;
drop policy if exists "shared quizzes anonymous insert" on public.shared_quizzes;
drop policy if exists "shared quizzes anonymous report" on public.shared_quizzes;
drop policy if exists "shared quizzes anonymous update" on public.shared_quizzes;
drop policy if exists "shared quizzes anonymous delete" on public.shared_quizzes;

create policy "shared quizzes visible select"
  on public.shared_quizzes for select
  using (true);

create policy "shared quizzes anonymous insert"
  on public.shared_quizzes for insert
  with check (true);

-- anon/authenticated는 원본 테이블을 직접 읽거나 수정/삭제하지 못하게 합니다.
-- 비밀번호/owner_token 노출을 막기 위해 목록/상세 조회는 public view로만 제공합니다.
revoke all on public.shared_quizzes from anon, authenticated;

create or replace view public.shared_quizzes_public as
select
  id,
  title,
  description,
  author_name,
  grade,
  semester,
  subject,
  unit,
  quiz_data,
  thumbnail_url,
  question_count,
  total_score,
  report_count,
  download_count,
  is_hidden,
  created_at,
  updated_at
from public.shared_quizzes;

grant select on public.shared_quizzes_public to anon, authenticated;


-- 공유 퀴즈 목록을 가볍게 불러오면서 현재 브라우저 owner_token 기준 소유 여부를 함께 반환합니다.
-- quiz_data 전체는 목록에서 제외하고, 미리보기/가져오기/수정 시 상세 조회로만 불러옵니다.
create or replace function public.list_shared_quizzes(
  p_grade text default null,
  p_semester text default null,
  p_subject text default null,
  p_unit text default null,
  p_keyword text default null,
  p_include_hidden boolean default false,
  p_page integer default 1,
  p_page_size integer default 24,
  p_owner_token text default null
)
returns table (
  id uuid,
  title text,
  description text,
  author_name text,
  grade text,
  semester text,
  subject text,
  unit text,
  thumbnail_url text,
  question_count integer,
  random_pick_enabled boolean,
  random_pick_count integer,
  total_score integer,
  report_count integer,
  download_count integer,
  is_hidden boolean,
  is_owner boolean,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language sql
security definer
set search_path = public
as $$
  with filtered as (
    select q.*
    from public.shared_quizzes q
    where (p_include_hidden or q.is_hidden = false)
      and (p_grade is null or q.grade = p_grade)
      and (p_semester is null or q.semester = p_semester)
      and (p_subject is null or q.subject = p_subject)
      and (p_unit is null or q.unit = p_unit)
      and (
        p_keyword is null
        or p_keyword = ''
        or q.title ilike '%' || p_keyword || '%'
        or q.description ilike '%' || p_keyword || '%'
        or coalesce(q.author_name, '') ilike '%' || p_keyword || '%'
      )
  )
  select
    f.id,
    f.title,
    f.description,
    f.author_name,
    f.grade,
    f.semester,
    f.subject,
    f.unit,
    f.thumbnail_url,
    f.question_count,
    coalesce((f.quiz_data->'settings'->>'randomPickEnabled')::boolean, false) as random_pick_enabled,
    coalesce((f.quiz_data->'settings'->>'randomPickCount')::integer, 0) as random_pick_count,
    f.total_score,
    f.report_count,
    f.download_count,
    f.is_hidden,
    (coalesce(f.owner_token, '') <> '' and coalesce(p_owner_token, '') <> '' and f.owner_token = p_owner_token) as is_owner,
    f.created_at,
    f.updated_at,
    count(*) over() as total_count
  from filtered f
  order by f.created_at desc
  offset greatest(0, (greatest(1, p_page) - 1) * least(48, greatest(12, p_page_size)))
  limit least(48, greatest(12, p_page_size));
$$;

create or replace function public.set_shared_quizzes_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists shared_quizzes_updated_at on public.shared_quizzes;
create trigger shared_quizzes_updated_at
before update on public.shared_quizzes
for each row execute procedure public.set_shared_quizzes_updated_at();

create or replace function public.create_shared_quiz(
  p_title text,
  p_description text,
  p_author_name text,
  p_grade text,
  p_semester text,
  p_subject text,
  p_unit text,
  p_quiz_data jsonb,
  p_thumbnail_url text,
  p_upload_password text,
  p_owner_token text,
  p_question_count integer,
  p_total_score integer
)
returns table (
  id uuid,
  title text,
  description text,
  author_name text,
  grade text,
  semester text,
  subject text,
  unit text,
  thumbnail_url text,
  question_count integer,
  total_score integer,
  report_count integer,
  download_count integer,
  is_hidden boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  insert into public.shared_quizzes (
    title, description, author_name, grade, semester, subject, unit,
    quiz_data, thumbnail_url, upload_password, owner_token,
    question_count, total_score, report_count, download_count, is_hidden
  ) values (
    p_title, coalesce(p_description, ''), nullif(p_author_name, ''),
    p_grade, p_semester, p_subject, p_unit,
    p_quiz_data, p_thumbnail_url, nullif(p_upload_password, ''), nullif(p_owner_token, ''),
    coalesce(p_question_count, 0), coalesce(p_total_score, 0), 0, 0, false
  )
  returning shared_quizzes.id into new_id;

  return query
  select
    q.id, q.title, q.description, q.author_name, q.grade, q.semester, q.subject, q.unit,
    q.thumbnail_url, q.question_count, q.total_score, q.report_count, q.download_count,
    q.is_hidden, q.created_at, q.updated_at
  from public.shared_quizzes q
  where q.id = new_id;
end;
$$;

create or replace function public.can_manage_shared_quiz(
  p_id uuid,
  p_password text default '',
  p_owner_token text default ''
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  target record;
begin
  select upload_password, owner_token
    into target
  from public.shared_quizzes
  where id = p_id;

  if not found then
    return false;
  end if;

  if coalesce(target.owner_token, '') <> ''
     and coalesce(p_owner_token, '') <> ''
     and target.owner_token = p_owner_token then
    return true;
  end if;

  if coalesce(target.upload_password, '') <> ''
     and coalesce(p_password, '') <> ''
     and target.upload_password = p_password then
    return true;
  end if;

  return false;
end;
$$;

create or replace function public.verify_shared_quiz_edit_access(
  p_id uuid,
  p_password text default '',
  p_owner_token text default ''
)
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.can_manage_shared_quiz(p_id, p_password, p_owner_token);
$$;

create or replace function public.update_shared_quiz_with_password(
  p_id uuid,
  p_password text,
  p_owner_token text,
  p_title text,
  p_description text,
  p_author_name text,
  p_grade text,
  p_semester text,
  p_subject text,
  p_unit text,
  p_thumbnail_url text,
  p_question_count integer,
  p_total_score integer,
  p_quiz_data jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_shared_quiz(p_id, p_password, p_owner_token) then
    raise exception '수정 권한이 없습니다.';
  end if;

  update public.shared_quizzes
  set
    title = p_title,
    description = coalesce(p_description, ''),
    author_name = nullif(p_author_name, ''),
    grade = p_grade,
    semester = p_semester,
    subject = p_subject,
    unit = p_unit,
    thumbnail_url = p_thumbnail_url,
    question_count = coalesce(p_question_count, 0),
    total_score = coalesce(p_total_score, 0),
    quiz_data = p_quiz_data
  where id = p_id;
end;
$$;

create or replace function public.delete_shared_quiz_with_password(
  p_id uuid,
  p_password text default '',
  p_owner_token text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_shared_quiz(p_id, p_password, p_owner_token) then
    raise exception '삭제 권한이 없습니다.';
  end if;

  delete from public.shared_quizzes where id = p_id;
end;
$$;

create or replace function public.increment_shared_quiz_download(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.shared_quizzes
  set download_count = coalesce(download_count, 0) + 1
  where id = p_id
  returning download_count into next_count;

  return coalesce(next_count, 0);
end;
$$;

create or replace function public.report_shared_quiz(p_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  next_count integer;
begin
  update public.shared_quizzes
  set
    report_count = coalesce(report_count, 0) + 1,
    is_hidden = (coalesce(report_count, 0) + 1) >= 3
  where id = p_id
  returning report_count into next_count;

  if next_count is null then
    raise exception '신고할 퀴즈를 찾지 못했습니다.';
  end if;

  return next_count;
end;
$$;

grant execute on function public.list_shared_quizzes(text, text, text, text, text, boolean, integer, integer, text) to anon, authenticated;
grant execute on function public.create_shared_quiz(text, text, text, text, text, text, text, jsonb, text, text, text, integer, integer) to anon, authenticated;
grant execute on function public.verify_shared_quiz_edit_access(uuid, text, text) to anon, authenticated;
grant execute on function public.update_shared_quiz_with_password(uuid, text, text, text, text, text, text, text, text, text, text, integer, integer, jsonb) to anon, authenticated;
grant execute on function public.delete_shared_quiz_with_password(uuid, text, text) to anon, authenticated;
grant execute on function public.increment_shared_quiz_download(uuid) to anon, authenticated;
grant execute on function public.report_shared_quiz(uuid) to anon, authenticated;
