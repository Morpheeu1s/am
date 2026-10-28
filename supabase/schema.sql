-- ==============================================================================
-- AMBITIEUX - DATABASE SCHEMA FOR SUPABASE (POSTGRESQL)
-- Goethe-Zertifikat A1 Vocabulary + SM-2 Spaced Repetition + Grammar Scenarios
-- ==============================================================================

-- 1. BẢNG TỪ VỰNG TIẾNG ĐỨC & THUẬT TOÁN SRS (SM-2)
CREATE TABLE IF NOT EXISTS public.words (
    id BIGSERIAL PRIMARY KEY,
    german TEXT UNIQUE NOT NULL,
    vietnamese TEXT NOT NULL,
    ipa TEXT DEFAULT '',
    category TEXT DEFAULT 'chung',
    part_of_speech TEXT DEFAULT 'noun',
    level TEXT DEFAULT 'A1',
    example TEXT DEFAULT '',
    example_vi TEXT DEFAULT '',
    audio_url TEXT DEFAULT '',
    repetition INTEGER DEFAULT 0,
    interval INTEGER DEFAULT 0,
    ease_factor NUMERIC(4,2) DEFAULT 2.50,
    due_date DATE DEFAULT CURRENT_DATE,
    mistakes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index tối ưu truy vấn SM-2 theo ngày ôn và danh mục
CREATE INDEX IF NOT EXISTS idx_words_due_date ON public.words (due_date);
CREATE INDEX IF NOT EXISTS idx_words_repetition ON public.words (repetition);
CREATE INDEX IF NOT EXISTS idx_words_category ON public.words (category);

-- 2. BẢNG LỊCH SỬ ÔN TẬP (TRACKING TIẾN ĐỘ & STREAK HẰNG NGÀY)
CREATE TABLE IF NOT EXISTS public.review_logs (
    id BIGSERIAL PRIMARY KEY,
    word_id BIGINT REFERENCES public.words(id) ON DELETE CASCADE,
    quality INTEGER CHECK (quality >= 0 AND quality <= 5),
    is_correct BOOLEAN NOT NULL,
    review_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_logs_date ON public.review_logs (review_date);

-- 3. MỞ RỘNG: BẢNG CHỦ ĐỀ NGỮ PHÁP (GRAMMAR TOPICS)
CREATE TABLE IF NOT EXISTS public.grammar_topics (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL, -- e.g: 'A1_ARTIKEL', 'A1_VERBKONJUGATION', 'A1_NOMINATIV', 'A1_AKKUSATIV'
    level TEXT DEFAULT 'A1',   -- 'A0', 'A1', 'A2', 'B1'
    title TEXT NOT NULL,       -- e.g: 'Quán từ xác định & bất định: der, die, das'
    description TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. MỞ RỘNG: BÀI HỌC VÀ CẤU TRÚC NGỮ PHÁP (GRAMMAR LESSONS & RULES)
CREATE TABLE IF NOT EXISTS public.grammar_lessons (
    id BIGSERIAL PRIMARY KEY,
    topic_id BIGINT REFERENCES public.grammar_topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    rule_formula TEXT,       -- e.g: 'Nominativ: der / die / das / die (Plural)'
    content_markdown TEXT,  -- Bài giảng Markdown chi tiết
    examples JSONB DEFAULT '[]'::jsonb, -- Array các câu ví dụ mẫu
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. MỞ RỘNG: TÌNH HUỐNG GIAO TIẾP THỰC TẾ (GRAMMAR SCENARIOS)
CREATE TABLE IF NOT EXISTS public.grammar_scenarios (
    id BIGSERIAL PRIMARY KEY,
    topic_id BIGINT REFERENCES public.grammar_topics(id) ON DELETE CASCADE,
    title TEXT NOT NULL,      -- e.g: 'Tại quán cà phê ở Berlin', 'Mua sắm tại siêu thị'
    context_desc TEXT,        -- Bối cảnh tình huống
    dialogue JSONB DEFAULT '[]'::jsonb, -- Cuộc hội thoại mẫu
    grammar_focus TEXT,       -- Điểm ngữ pháp cần chú ý trong tình huống
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. MỞ RỘNG: BÀI TẬP NGỮ PHÁP TƯƠNG TÁC (GRAMMAR EXERCISES)
CREATE TABLE IF NOT EXISTS public.grammar_exercises (
    id BIGSERIAL PRIMARY KEY,
    topic_id BIGINT REFERENCES public.grammar_topics(id) ON DELETE CASCADE,
    scenario_id BIGINT REFERENCES public.grammar_scenarios(id) ON DELETE SET NULL,
    type TEXT NOT NULL,     -- 'choice' | 'fill_blank' | 'reorder' | 'translate'
    prompt TEXT NOT NULL,
    options JSONB DEFAULT '[]'::jsonb, -- Các lựa chọn trắc nghiệm
    solution TEXT NOT NULL,
    explanation TEXT,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. TIẾN ĐỘ TỔNG QUAN VÀ STREAK NGƯỜI HỌC (USER PROGRESS)
CREATE TABLE IF NOT EXISTS public.user_progress (
    id TEXT PRIMARY KEY DEFAULT 'current_user',
    streak_count INTEGER DEFAULT 0,
    last_studied_date DATE DEFAULT CURRENT_DATE,
    total_reviews INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{"newWordsPerBatch": 10, "speechRate": 1.0}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- CẤU HÌNH ROW LEVEL SECURITY (RLS)
-- Cho phép truy cập và đồng bộ trực tiếp với Anon Key
-- ==============================================================================

ALTER TABLE public.words ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grammar_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_progress ENABLE ROW LEVEL SECURITY;

-- 1. Policies cho bảng words
DROP POLICY IF EXISTS "Cho phép đọc từ vựng" ON public.words;
DROP POLICY IF EXISTS "Cho phép thêm từ vựng" ON public.words;
DROP POLICY IF EXISTS "Cho phép sửa từ vựng" ON public.words;
DROP POLICY IF EXISTS "Cho phép xóa từ vựng" ON public.words;

CREATE POLICY "Cho phép đọc từ vựng" ON public.words FOR SELECT USING (true);
CREATE POLICY "Cho phép thêm từ vựng" ON public.words FOR INSERT WITH CHECK (true);
CREATE POLICY "Cho phép sửa từ vựng" ON public.words FOR UPDATE USING (true);
CREATE POLICY "Cho phép xóa từ vựng" ON public.words FOR DELETE USING (true);

-- 2. Policies cho bảng review_logs
DROP POLICY IF EXISTS "Cho phép đọc logs" ON public.review_logs;
DROP POLICY IF EXISTS "Cho phép ghi logs" ON public.review_logs;

CREATE POLICY "Cho phép đọc logs" ON public.review_logs FOR SELECT USING (true);
CREATE POLICY "Cho phép ghi logs" ON public.review_logs FOR INSERT WITH CHECK (true);

-- 3. Policies cho các bảng ngữ pháp & tình huống
DROP POLICY IF EXISTS "Công khai grammar_topics" ON public.grammar_topics;
DROP POLICY IF EXISTS "Công khai grammar_lessons" ON public.grammar_lessons;
DROP POLICY IF EXISTS "Công khai grammar_scenarios" ON public.grammar_scenarios;
DROP POLICY IF EXISTS "Công khai grammar_exercises" ON public.grammar_exercises;

CREATE POLICY "Công khai grammar_topics" ON public.grammar_topics FOR ALL USING (true);
CREATE POLICY "Công khai grammar_lessons" ON public.grammar_lessons FOR ALL USING (true);
CREATE POLICY "Công khai grammar_scenarios" ON public.grammar_scenarios FOR ALL USING (true);
CREATE POLICY "Công khai grammar_exercises" ON public.grammar_exercises FOR ALL USING (true);

-- 4. Policies cho bảng user_progress
DROP POLICY IF EXISTS "Công khai user_progress" ON public.user_progress;
CREATE POLICY "Công khai user_progress" ON public.user_progress FOR ALL USING (true);

-- ==============================================================================
-- SAMPLE SEED DATA: MỘT SỐ CHỦ ĐỀ NGỮ PHÁP MẪU GOETHE A1
-- ==============================================================================
INSERT INTO public.grammar_topics (code, level, title, description, order_index)
VALUES
  ('A1_ARTIKEL', 'A1', 'Quán từ xác định & bất định: der, die, das', 'Quy tắc phân biệt giống đực, giống cái, giống trung trong tiếng Đức', 1),
  ('A1_VERBEN_PRAESENS', 'A1', 'Chia động từ ở thì hiện tại (Präsens)', 'Đuôi chia động từ theo các đại từ nhân xưng ich, du, er/sie/es, wir, ihr, sie/Sie', 2),
  ('A1_NOMINATIV_AKKUSATIV', 'A1', 'Cách 1 & Cách 4 (Nominativ & Akkusativ)', 'Chủ ngữ và tân ngữ trực tiếp (sự biến đổi của quán từ der -> den)', 3),
  ('A1_MODALVERBEN', 'A1', 'Trợ động từ tình thái (können, müssen, möchten)', 'Cách sử dụng trợ động từ đi kèm động từ nguyên thể ở cuối câu', 4)
ON CONFLICT (code) DO NOTHING;
