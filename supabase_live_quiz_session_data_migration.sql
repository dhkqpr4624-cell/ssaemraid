-- 실시간 함께 풀기 모드 추가 상태 저장용 컬럼입니다.
-- 이미 live_sessions 테이블이 있다면 Supabase SQL Editor에서 1회 실행해 주세요.
-- 새 프로젝트에서 supabase_schema_fixed.sql을 다시 적용하는 경우에는 아래 컬럼도 함께 반영됩니다.

ALTER TABLE public.live_sessions
  ADD COLUMN IF NOT EXISTS session_data JSONB DEFAULT '{}'::jsonb;

-- 선택 사항: 상태 조회 속도 보조 인덱스
CREATE INDEX IF NOT EXISTS idx_live_sessions_status ON public.live_sessions(status);
