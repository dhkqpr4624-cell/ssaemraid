-- 퀴즈 탐색 화면에서 전체 문항 수 옆에 랜덤 출제 문항 수를 표시하기 위한 RPC 수정입니다.
-- Supabase SQL Editor에서 이 파일 전체를 Run 하세요.

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

grant execute on function public.list_shared_quizzes(text, text, text, text, text, boolean, integer, integer, text) to anon, authenticated;
