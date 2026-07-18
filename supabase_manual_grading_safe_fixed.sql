-- SsaemQuest 수동 채점 기능 안전 보정 SQL
-- 기존 데이터 삭제 없이 여러 번 실행해도 안전합니다.
-- 주의: 기존 Manus SQL의 trigger_update_grading_status는 보상 수령 등 일반 UPDATE 때도
-- grading_status를 바꿀 수 있으므로 제거하고, 앱 코드에서 채점 완료 시 상태를 저장합니다.

-- 1) 필요한 컬럼 추가
ALTER TABLE public.quiz_results
ADD COLUMN IF NOT EXISTS manual_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS pending_score INTEGER DEFAULT 0;

-- 2) 위험한 자동 트리거 제거: 채점 저장 함수에서 명시적으로 상태 변경
DROP TRIGGER IF EXISTS trigger_update_grading_status ON public.quiz_results;
DROP FUNCTION IF EXISTS public.update_grading_status_on_complete();

-- 3) 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_quiz_results_grading_status
ON public.quiz_results(class_code, grading_status);

CREATE INDEX IF NOT EXISTS idx_quiz_results_student
ON public.quiz_results(student_id, quiz_id, attempt_number);

CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz_submitted
ON public.quiz_results(quiz_id, submitted_at DESC);

-- 4) 기존 데이터 상태 보정
UPDATE public.quiz_results
SET grading_status = 'auto_complete'
WHERE grading_status IS NULL OR grading_status = '';

-- answers 배열 안에 needsReview=true가 있으면 채점 대기로 보정
UPDATE public.quiz_results qr
SET grading_status = 'pending_review'
WHERE qr.grading_status NOT IN ('fully_graded', 'graded')
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(qr.answers, '[]'::jsonb)) = 'array'
        THEN COALESCE(qr.answers, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS answer
    WHERE COALESCE((answer ->> 'needsReview')::boolean, false) = true
  );

-- 과거 SQL로 graded가 들어간 경우 앱 표준값 fully_graded로 정리
UPDATE public.quiz_results
SET grading_status = 'fully_graded'
WHERE grading_status = 'graded';

-- 5) 선택용 뷰: students.student_name 컬럼이 없는 현재 스키마에 맞춤
CREATE OR REPLACE VIEW public.pending_review_results AS
SELECT
  qr.id,
  qr.quiz_id,
  qr.student_id,
  qr.class_code,
  qr.attendance_number,
  COALESCE(s.attendance_number, qr.attendance_number) AS student_number,
  ('학생 ' || COALESCE(s.attendance_number, qr.attendance_number)::text) AS student_name,
  qr.score,
  qr.total_score,
  qr.auto_score,
  qr.manual_score,
  qr.pending_score,
  qr.answers,
  qr.submitted_at,
  qr.attempt_number,
  q.title AS quiz_title,
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements(
      CASE
        WHEN jsonb_typeof(COALESCE(qr.answers, '[]'::jsonb)) = 'array'
        THEN COALESCE(qr.answers, '[]'::jsonb)
        ELSE '[]'::jsonb
      END
    ) AS answer
    WHERE COALESCE((answer ->> 'needsReview')::boolean, false) = true
  ) AS has_pending_items
FROM public.quiz_results qr
LEFT JOIN public.students s ON qr.student_id = s.id
LEFT JOIN public.quizzes q ON qr.quiz_id = q.quiz_id
WHERE qr.grading_status = 'pending_review'
ORDER BY qr.submitted_at ASC;

-- 6) Supabase/PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
