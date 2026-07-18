-- SsaemQuest Phase 4 hotfix SQL
-- 랜덤 출제 attempt별 문항 고정용 스냅샷 컬럼입니다.
-- 기존 데이터 삭제 없이 여러 번 실행해도 안전합니다.

ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS question_snapshot JSONB DEFAULT '[]'::jsonb;

UPDATE public.quiz_results
SET question_snapshot = COALESCE(question_snapshot, '[]'::jsonb)
WHERE question_snapshot IS NULL;

NOTIFY pgrst, 'reload schema';
