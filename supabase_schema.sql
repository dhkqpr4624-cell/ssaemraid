-- 쌤퀘스트 Supabase 스키마 설계

-- UUID 확장 기능 활성화
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 클래스 테이블 (classes)
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_code TEXT UNIQUE NOT NULL,
  teacher_password TEXT NOT NULL,
  student_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. 학생 테이블 (students)
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  class_code TEXT REFERENCES classes(class_code) ON DELETE CASCADE,
  attendance_number INTEGER NOT NULL,
  score INTEGER DEFAULT 0,
  items JSONB DEFAULT '[]'::jsonb,
  avatar_state JSONB DEFAULT '{}'::jsonb,
  room_state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(class_code, attendance_number)
);

-- 3. 퀴즈 테이블 (quizzes)
CREATE TABLE quizzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id TEXT UNIQUE NOT NULL,
  class_code TEXT REFERENCES classes(class_code) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  questions JSONB NOT NULL,
  reward_options JSONB DEFAULT '[]'::jsonb,
  settings JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. 퀴즈 결과 테이블 (quiz_results)
CREATE TABLE quiz_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  quiz_id TEXT REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  score INTEGER NOT NULL,
  answers JSONB NOT NULL,
  selected_reward JSONB,
  is_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(student_id, quiz_id)
);

-- 5. 실시간 세션 테이블 (live_sessions)
CREATE TABLE live_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  quiz_id TEXT REFERENCES quizzes(quiz_id) ON DELETE CASCADE,
  class_code TEXT REFERENCES classes(class_code) ON DELETE CASCADE,
  current_question_index INTEGER DEFAULT 0,
  status TEXT DEFAULT 'waiting', -- waiting, active, finished
  question_started_at TIMESTAMP WITH TIME ZONE,
  session_data JSONB DEFAULT '{}'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(class_code, quiz_id)
);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE live_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE quiz_results;
ALTER PUBLICATION supabase_realtime ADD TABLE students;

-- Row Level Security (RLS) 설정
-- 모든 테이블에 RLS 활성화
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE live_sessions ENABLE ROW LEVEL SECURITY;

-- RLS 정책 정의

-- classes 테이블 정책
-- 모든 사용자가 클래스 코드를 조회할 수 있도록 허용 (클래스 존재 여부 확인용)
CREATE POLICY "Allow public read access to classes" ON public.classes FOR SELECT USING (true);
-- 교사가 자신의 클래스를 생성할 수 있도록 허용 (auth.uid()는 사용하지 않으므로, 익명 사용자도 생성 가능하도록 설정)
CREATE POLICY "Allow insert for classes" ON public.classes FOR INSERT WITH CHECK (true);
-- 교사가 자신의 클래스 정보를 업데이트할 수 있도록 허용 (class_code 일치 여부로 판단)
CREATE POLICY "Allow update for classes by class_code" ON public.classes FOR UPDATE USING (class_code = OLD.class_code);
-- 교사가 자신의 클래스를 삭제할 수 있도록 허용 (class_code 일치 여부로 판단)
CREATE POLICY "Allow delete for classes by class_code" ON public.classes FOR DELETE USING (class_code = OLD.class_code);

-- students 테이블 정책
-- 클래스 코드에 해당하는 학생 데이터만 조회 허용
CREATE POLICY "Allow read access to students by class_code" ON public.students FOR SELECT USING (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 학생 데이터만 삽입 허용
CREATE POLICY "Allow insert access to students by class_code" ON public.students FOR INSERT WITH CHECK (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 학생 데이터만 업데이트 허용
CREATE POLICY "Allow update access to students by class_code" ON public.students FOR UPDATE USING (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 학생 데이터만 삭제 허용
CREATE POLICY "Allow delete access to students by class_code" ON public.students FOR DELETE USING (class_code = request.jwt() ->> 'class_code');

-- quizzes 테이블 정책
-- 클래스 코드에 해당하는 퀴즈 데이터만 조회 허용
CREATE POLICY "Allow read access to quizzes by class_code" ON public.quizzes FOR SELECT USING (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 퀴즈 데이터만 삽입 허용
CREATE POLICY "Allow insert access to quizzes by class_code" ON public.quizzes FOR INSERT WITH CHECK (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 퀴즈 데이터만 업데이트 허용
CREATE POLICY "Allow update access to quizzes by class_code" ON public.quizzes FOR UPDATE USING (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 퀴즈 데이터만 삭제 허용
CREATE POLICY "Allow delete access to quizzes by class_code" ON public.quizzes FOR DELETE USING (class_code = request.jwt() ->> 'class_code');

-- quiz_results 테이블 정책
-- 클래스 코드에 해당하는 퀴즈 결과 데이터만 조회 허용
CREATE POLICY "Allow read access to quiz_results by class_code" ON public.quiz_results FOR SELECT USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.quiz_id = quiz_results.quiz_id AND quizzes.class_code = request.jwt() ->> 'class_code'));
-- 클래스 코드에 해당하는 퀴즈 결과 데이터만 삽입 허용
CREATE POLICY "Allow insert access to quiz_results by class_code" ON public.quiz_results FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.quiz_id = quiz_results.quiz_id AND quizzes.class_code = request.jwt() ->> 'class_code'));
-- 클래스 코드에 해당하는 퀴즈 결과 데이터만 업데이트 허용
CREATE POLICY "Allow update access to quiz_results by class_code" ON public.quiz_results FOR UPDATE USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.quiz_id = quiz_results.quiz_id AND quizzes.class_code = request.jwt() ->> 'class_code'));
-- 클래스 코드에 해당하는 퀴즈 결과 데이터만 삭제 허용
CREATE POLICY "Allow delete access to quiz_results by class_code" ON public.quiz_results FOR DELETE USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.quiz_id = quiz_results.quiz_id AND quizzes.class_code = request.jwt() ->> 'class_code'));

-- live_sessions 테이블 정책
-- 클래스 코드에 해당하는 실시간 세션 데이터만 조회 허용
CREATE POLICY "Allow read access to live_sessions by class_code" ON public.live_sessions FOR SELECT USING (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 실시간 세션 데이터만 삽입 허용
CREATE POLICY "Allow insert access to live_sessions by class_code" ON public.live_sessions FOR INSERT WITH CHECK (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 실시간 세션 데이터만 업데이트 허용
CREATE POLICY "Allow update access to live_sessions by class_code" ON public.live_sessions FOR UPDATE USING (class_code = request.jwt() ->> 'class_code');
-- 클래스 코드에 해당하는 실시간 세션 데이터만 삭제 허용
CREATE POLICY "Allow delete access to live_sessions by class_code" ON public.live_sessions FOR DELETE USING (class_code = request.jwt() ->> 'class_code');
