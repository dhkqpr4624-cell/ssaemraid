-- ============================================
-- 쌤퀘스트 Supabase 스키마 (수정 버전)
-- ============================================
-- 
-- 주의사항:
-- 1. RLS 정책에서 OLD 테이블 참조 제거 (RLS에서는 사용 불가)
-- 2. JWT 기반 인증 대신 클래스코드 기반의 단순 정책 사용
-- 3. anon key로도 동작하도록 설정
-- 4. 완벽한 보안은 나중에 서버 API/Edge Function으로 보완 예정
--
-- 실행 방법:
-- 1. Supabase 대시보드 > SQL Editor 접속
-- 2. 이 파일의 전체 내용 복사
-- 3. SQL Editor에 붙여넣기
-- 4. RUN 버튼 클릭

-- ============================================
-- 1. UUID 확장 기능 활성화
-- ============================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 2. 기존 정책 및 테이블 제거 (idempotent)
-- ============================================

-- 기존 정책 제거
DROP POLICY IF EXISTS "Allow public read access to classes" ON public.classes;
DROP POLICY IF EXISTS "Allow insert for classes" ON public.classes;
DROP POLICY IF EXISTS "Allow update for classes by class_code" ON public.classes;
DROP POLICY IF EXISTS "Allow delete for classes by class_code" ON public.classes;
DROP POLICY IF EXISTS "Allow read access to students by class_code" ON public.students;
DROP POLICY IF EXISTS "Allow insert access to students by class_code" ON public.students;
DROP POLICY IF EXISTS "Allow update access to students by class_code" ON public.students;
DROP POLICY IF EXISTS "Allow delete access to students by class_code" ON public.students;
DROP POLICY IF EXISTS "Allow read access to quizzes by class_code" ON public.quizzes;
DROP POLICY IF EXISTS "Allow insert access to quizzes by class_code" ON public.quizzes;
DROP POLICY IF EXISTS "Allow update access to quizzes by class_code" ON public.quizzes;
DROP POLICY IF EXISTS "Allow delete access to quizzes by class_code" ON public.quizzes;
DROP POLICY IF EXISTS "Allow read access to quiz_results by class_code" ON public.quiz_results;
DROP POLICY IF EXISTS "Allow insert access to quiz_results by class_code" ON public.quiz_results;
DROP POLICY IF EXISTS "Allow update access to quiz_results by class_code" ON public.quiz_results;
DROP POLICY IF EXISTS "Allow delete access to quiz_results by class_code" ON public.quiz_results;
DROP POLICY IF EXISTS "Allow read access to live_sessions by class_code" ON public.live_sessions;
DROP POLICY IF EXISTS "Allow insert access to live_sessions by class_code" ON public.live_sessions;
DROP POLICY IF EXISTS "Allow update access to live_sessions by class_code" ON public.live_sessions;
DROP POLICY IF EXISTS "Allow delete access to live_sessions by class_code" ON public.live_sessions;

-- 기존 테이블 제거 (외래 키 제약 때문에 순서 중요)
DROP TABLE IF EXISTS public.live_sessions CASCADE;
DROP TABLE IF EXISTS public.quiz_results CASCADE;
DROP TABLE IF EXISTS public.quizzes CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.classes CASCADE;

-- ============================================
-- 3. 테이블 생성
-- ============================================

-- 클래스 테이블
CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_code TEXT UNIQUE NOT NULL,
  class_name TEXT NOT NULL DEFAULT '클래스',
  teacher_password TEXT NOT NULL,
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 학생 테이블
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_code TEXT REFERENCES public.classes(class_code) ON DELETE CASCADE,
  attendance_number INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  avatar_state JSONB DEFAULT '{}'::jsonb,
  room_state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(class_code, attendance_number)
);

-- 퀴즈 테이블
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id TEXT UNIQUE NOT NULL,
  class_code TEXT REFERENCES public.classes(class_code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL,
  reward_options JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 퀴즈 결과 테이블
CREATE TABLE public.quiz_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES public.students(id) ON DELETE CASCADE,
  quiz_id TEXT REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL,
  selected_reward JSONB,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, quiz_id)
);

-- 실시간 세션 테이블
CREATE TABLE public.live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id TEXT REFERENCES public.quizzes(quiz_id) ON DELETE CASCADE,
  class_code TEXT REFERENCES public.classes(class_code) ON DELETE CASCADE,
  current_question_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting',
  question_started_at TIMESTAMP WITH TIME ZONE,
  session_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(class_code, quiz_id)
);

-- ============================================
-- 4. 인덱스 생성 (성능 최적화)
-- ============================================

CREATE INDEX idx_students_class_code ON public.students(class_code);
CREATE INDEX idx_students_attendance ON public.students(class_code, attendance_number);
CREATE INDEX idx_quizzes_class_code ON public.quizzes(class_code);
CREATE INDEX idx_quiz_results_student_id ON public.quiz_results(student_id);
CREATE INDEX idx_quiz_results_quiz_id ON public.quiz_results(quiz_id);
CREATE INDEX idx_live_sessions_class_code ON public.live_sessions(class_code);

-- ============================================
-- 5. Realtime 활성화
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.quiz_results;
ALTER PUBLICATION supabase_realtime ADD TABLE public.students;
ALTER PUBLICATION supabase_realtime ADD TABLE public.classes;

-- ============================================
-- 6. Row Level Security (RLS) 설정
-- ============================================
--
-- 현재 앱은 JWT 기반 인증을 사용하지 않고 클래스코드+비밀번호/출석번호 방식을 사용합니다.
-- 따라서 RLS는 단순 정책으로 설정하고, 완벽한 보안은 나중에 서버 API/Edge Function으로 보완합니다.
--
-- TODO: 보안 강화
-- - 서버 API 또는 Supabase Edge Function에서 클래스코드 검증 추가
-- - 교사 비밀번호 검증 로직 추가
-- - 학생 출석번호 검증 로직 추가
-- - 클라이언트 코드에서 RLS 우회 방지
--

-- 모든 테이블에 RLS 활성화
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_sessions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. 임시 정책 (모든 사용자 허용)
-- ============================================
--
-- 주의: 이 정책은 임시이며, 클라이언트 코드에서 클래스코드 검증을 수행합니다.
-- 프로덕션 배포 전에 서버 API 또는 Edge Function으로 보안을 강화해야 합니다.
--

-- classes 테이블
CREATE POLICY "classes_allow_all_read" ON public.classes FOR SELECT USING (true);
CREATE POLICY "classes_allow_all_insert" ON public.classes FOR INSERT WITH CHECK (true);
CREATE POLICY "classes_allow_all_update" ON public.classes FOR UPDATE USING (true);
CREATE POLICY "classes_allow_all_delete" ON public.classes FOR DELETE USING (true);

-- students 테이블
CREATE POLICY "students_allow_all_read" ON public.students FOR SELECT USING (true);
CREATE POLICY "students_allow_all_insert" ON public.students FOR INSERT WITH CHECK (true);
CREATE POLICY "students_allow_all_update" ON public.students FOR UPDATE USING (true);
CREATE POLICY "students_allow_all_delete" ON public.students FOR DELETE USING (true);

-- quizzes 테이블
CREATE POLICY "quizzes_allow_all_read" ON public.quizzes FOR SELECT USING (true);
CREATE POLICY "quizzes_allow_all_insert" ON public.quizzes FOR INSERT WITH CHECK (true);
CREATE POLICY "quizzes_allow_all_update" ON public.quizzes FOR UPDATE USING (true);
CREATE POLICY "quizzes_allow_all_delete" ON public.quizzes FOR DELETE USING (true);

-- quiz_results 테이블
CREATE POLICY "quiz_results_allow_all_read" ON public.quiz_results FOR SELECT USING (true);
CREATE POLICY "quiz_results_allow_all_insert" ON public.quiz_results FOR INSERT WITH CHECK (true);
CREATE POLICY "quiz_results_allow_all_update" ON public.quiz_results FOR UPDATE USING (true);
CREATE POLICY "quiz_results_allow_all_delete" ON public.quiz_results FOR DELETE USING (true);

-- live_sessions 테이블
CREATE POLICY "live_sessions_allow_all_read" ON public.live_sessions FOR SELECT USING (true);
CREATE POLICY "live_sessions_allow_all_insert" ON public.live_sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "live_sessions_allow_all_update" ON public.live_sessions FOR UPDATE USING (true);
CREATE POLICY "live_sessions_allow_all_delete" ON public.live_sessions FOR DELETE USING (true);

-- ============================================
-- 8. 완료 메시지
-- ============================================
-- 스키마 생성이 완료되었습니다.
-- 다음 단계:
-- 1. 클래스 생성 페이지에서 db-wrapper 사용하도록 수정
-- 2. 학생 페이지 이동 시 세션 유지 기능 추가
-- 3. 퀴즈 기능 Supabase 연동
-- 4. 실시간 퀴즈 Realtime 구독 추가
-- 5. 보안 강화를 위해 서버 API/Edge Function 추가 (TODO)
