# TÀI LIỆU CHUẨN HÓA ĐỊNH DẠNG DỮ LIỆU AMBITIEUX
> Chuẩn hóa cấu trúc nạp dữ liệu Từ vựng (Vocabulary) và Ngữ pháp & Kịch bản tình huống (Grammar & Scenarios) cho ứng dụng Ambitieux & Supabase PostgreSQL.

---

## MỤC LỤC
1. [Chuẩn hóa Định dạng Từ vựng (Vocabulary)](#1-chuẩn-hóa-định-dạng-từ-vựng)
   - [Bảng quy cách các trường dữ liệu](#11-bảng-quy-cách-các-trường-dữ-liệu)
   - [Định dạng TSV / Anki (Khuyên dùng khi import file)](#12-định-dạng-tsv--anki)
   - [Định dạng CSV (Dùng với Excel / Google Sheets)](#13-định-dạng-csv)
   - [Định dạng JSON (Dùng cho API / Supabase Bulk)](#14-định-dạng-json)
2. [Chuẩn hóa Định dạng Ngữ pháp & Kịch bản (Grammar & Scenarios)](#2-chuẩn-hóa-định-dạng-ngữ-pháp--kịch-bản)
   - [Chủ đề ngữ pháp (grammar_topics)](#21-chủ-đề-ngữ-pháp)
   - [Bài học lý thuyết (grammar_lessons)](#22-bài-học-lý-thuyết)
   - [Kịch bản tình huống thực tế (grammar_scenarios)](#23-kịch-bản-tình-huống-thực-tế)
   - [Bài tập tương tác (grammar_exercises)](#24-bài-tập-tương-tác)
3. [Mẫu dữ liệu hoàn chỉnh sẵn sàng nạp lên Supabase](#3-mẫu-dữ-liệu-hoàn-chỉnh-nạp-supabase)

---

## 1. CHUẨN HÓA ĐỊNH DẠNG TỪ VỰNG

### 1.1. Bảng quy cách các trường dữ liệu

| Tên trường | Kiểu dữ liệu | Bắt buộc | Ví dụ mẫu | Mô tả & Quy tắc chuẩn hóa |
| :--- | :--- | :---: | :--- | :--- |
| **`german`** | `string` | **Có** | `der Tisch`, `Guten Tag` | Danh từ tiếng Đức **bắt buộc viết hoa** chữ cái đầu và nên kèm quán từ (`der`, `die`, `das`). |
| **`vietnamese`** | `string` | **Có** | `cái bàn`, `xin chào` | Nghĩa tiếng Việt rõ ràng, ngắn gọn, có thể phân tách nhiều nghĩa bằng dấu `/`. |
| **`ipa`** | `string` | Không | `[tɪʃ]`, `[ɡuːtn̩ ˈtaːk]` | Phiên âm quốc tế IPA đặt trong cặp ngoặc vuông `[...]` hoặc gạch chéo `/.../`. |
| **`category`** | `string` | Không | `nhà ở`, `giao tiếp` | Chủ đề từ vựng (chữ thường, ví dụ: `giao tiếp`, `ăn uống`, `gia đình`, `nghề nghiệp`, `nhà ở`, `du lịch`). Mặc định: `chung`. |
| **`part_of_speech`**| `string` | Không | `noun`, `verb`, `adj` | Từ loại: `noun` (danh từ), `verb` (động từ), `adjective` (tính từ), `adverb` (phó từ), `preposition` (giới từ). |
| **`example`** | `string` | Không | `Der Tisch ist neu.` | Câu ví dụ ngữ cảnh tiếng Đức chuẩn A1, chứa từ vựng đang học. |
| **`example_vi`** | `string` | Không | `Cái bàn này còn mới.` | Bản dịch tiếng Việt chuẩn xác cho câu ví dụ. |
| **`level`** | `string` | Không | `A1` | Trình độ theo khung chuẩn Goethe/CEFR (`A0`, `A1`, `A2`, `B1`). Mặc định: `A1`. |

---

### 1.2. Định dạng TSV / Anki (Dán bảng Text hoặc Import file `.txt`, `.tsv`)
Mỗi trường phân tách bằng ký tự **Tab (`\t`)**, mỗi từ nằm trên một dòng riêng biệt.

#### Thứ tự các cột:
```
Từ_tiếng_Đức [Tab] Phiên_âm_IPA [Tab] Nghĩa_tiếng_Việt [Tab] Chủ_đề [Tab] Câu_ví_dụ_Đức [Tab] Dịch_câu_ví_dụ
```

#### Dữ liệu mẫu copy trực tiếp:
```tsv
der Tisch	[tɪʃ]	cái bàn	nhà ở	Der Tisch ist neu.	Cái bàn này còn mới.
die Lampe	[ˈlampə]	cây đèn	nhà ở	Die Lampe ist hell.	Cây đèn rất sáng.
trinken	[ˈtʁɪŋkn̩]	uống	ăn uống	Ich trinke Wasser.	Tôi uống nước lọc.
essen	[ˈɛsn̩]	ăn	ăn uống	Wir essen Pizza.	Chúng tôi ăn pizza.
helfen	[ˈhɛlfn̩]	giúp đỡ	giao tiếp	Kann ich Ihnen helfen?	Tôi có thể giúp gì cho bạn?
```

---

### 1.3. Định dạng CSV (Dùng cho Excel / Google Sheets)
Sử dụng dấu phẩy `,` hoặc chấm phẩy `;` làm dấu phân tách. Nếu trường có chứa dấu phẩy thì bọc trong ngoặc kép `""`.

#### Dữ liệu mẫu CSV (Lưu encoding UTF-8):
```csv
german,ipa,vietnamese,category,example,example_vi
"der Tisch","[tɪʃ]","cái bàn","nhà ở","Der Tisch ist neu.","Cái bàn này còn mới."
"die Lampe","[ˈlampə]","cây đèn","nhà ở","Die Lampe ist hell.","Cây đèn rất sáng."
"trinken","[ˈtʁɪŋkn̩]","uống","ăn uống","Ich trinke Wasser.","Tôi uống nước lọc."
"schlafen","[ˈʃlaːfn̩]","ngủ","đời sống","Er schläft gut.","Anh ấy ngủ ngon."
```

---

### 1.4. Định dạng JSON (Dùng nạp trực tiếp qua Supabase / REST API)
```json
[
  {
    "german": "der Kaffee",
    "ipa": "[ˈkafe]",
    "vietnamese": "cà phê",
    "category": "ăn uống",
    "part_of_speech": "noun",
    "level": "A1",
    "example": "Möchten Sie einen Kaffee?",
    "example_vi": "Bạn có muốn dùng một tách cà phê không?",
    "repetition": 0,
    "interval": 0,
    "ease_factor": 2.50,
    "mistakes": 0
  },
  {
    "german": "wohnen",
    "ipa": "[ˈvoːnən]",
    "vietnamese": "sống, cư trú",
    "category": "nhà ở",
    "part_of_speech": "verb",
    "level": "A1",
    "example": "Ich wohne in Berlin.",
    "example_vi": "Tôi sống ở Berlin.",
    "repetition": 0,
    "interval": 0,
    "ease_factor": 2.50,
    "mistakes": 0
  }
]
```

---

## 2. CHUẨN HÓA ĐỊNH DẠNG NGỮ PHÁP & KỊCH BẢN (GRAMMAR & SCENARIOS)

Hệ thống ngữ pháp Ambitieux phân tầng thành 4 cấp độ dữ liệu liên kết quan hệ (Relational):

```
grammar_topics (Chủ đề tổng quát)
  ├── grammar_lessons (Lý thuyết & Công thức)
  ├── grammar_scenarios (Tình huống giao tiếp thực tế)
  └── grammar_exercises (Bài tập tương tác kiểm tra)
```

---

### 2.1. Chủ đề ngữ pháp (`grammar_topics`)

#### Cấu trúc:
- `code` *(string, unique)*: Mã định danh viết hoa không dấu, ví dụ: `A1_ARTIKEL`, `A1_VERBKONJUGATION`.
- `level` *(string)*: `A0`, `A1`, `A2`, `B1`.
- `title` *(string)*: Tiêu đề chuyên đề.
- `description` *(string)*: Tóm tắt nội dung cốt lõi cần nắm.
- `order_index` *(number)*: Thứ tự hiển thị trong lộ trình học.

#### Mẫu JSON:
```json
{
  "code": "A1_ARTIKEL_BESTIMMT",
  "level": "A1",
  "title": "Quán từ xác định: der, die, das",
  "description": "Cách xác định giống đực (Maskulin), giống cái (Feminin), và giống trung (Neutral) trong tiếng Đức.",
  "order_index": 1
}
```

---

### 2.2. Bài học lý thuyết (`grammar_lessons`)

#### Cấu trúc:
- `topic_code` *(string)*: Mã chủ đề cha liên kết.
- `title` *(string)*: Tựa đề bài học.
- `rule_formula` *(string)*: Công thức tóm tắt ngắn gọn hiển thị trên thẻ bài học.
- `content_markdown` *(string)*: Toàn bộ bài giảng định dạng Markdown.
- `examples` *(array of objects)*: Danh sách câu ví dụ mẫu.

#### Mẫu JSON:
```json
{
  "topic_code": "A1_ARTIKEL_BESTIMMT",
  "title": "Ba giống ngữ pháp cơ bản",
  "rule_formula": "der (Maskulin) | die (Feminin) | das (Neutral) | die (Plural)",
  "content_markdown": "Trong tiếng Đức, mọi danh từ đều có giống ngữ pháp riêng và **luôn được viết hoa chữ cái đầu**.\n\n- Giống đực (Maskulin): `der Mann` (người đàn ông), `der Tisch` (cái bàn).\n- Giống cái (Feminin): `die Frau` (người phụ nữ), `die Lampe` (cây đèn).\n- Giống trung (Neutral): `das Kind` (đứa trẻ), `das Buch` (cuốn sách).\n- Số nhiều (Plural): Tất cả các giống khi chuyển sang số nhiều đều dùng quán từ `die`.",
  "examples": [
    { "de": "Der Mann trinkt Kaffee.", "vi": "Người đàn ông uống cà phê." },
    { "de": "Die Frau liest ein Buch.", "vi": "Người phụ nữ đọc một cuốn sách." },
    { "de": "Das Kind spielt im Garten.", "vi": "Đứa trẻ chơi trong vườn." }
  ],
  "order_index": 1
}
```

---

### 2.3. Kịch bản tình huống thực tế (`grammar_scenarios`)

Phục vụ việc học ngữ pháp lồng ghép vào đời sống thực tế (Active Learning qua ngữ cảnh).

#### Cấu trúc:
- `topic_code` *(string)*: Mã chủ đề ngữ pháp áp dụng.
- `title` *(string)*: Tên tình huống (ví dụ: *Tại quán cà phê ở Berlin*).
- `context_desc` *(string)*: Mô tả hoàn cảnh.
- `grammar_focus` *(string)*: Trọng tâm ngữ pháp người học cần lưu ý trong đoạn hội thoại.
- `dialogue` *(array of objects)*: Từng lời thoại kèm người nói và dịch nghĩa.

#### Mẫu JSON:
```json
{
  "topic_code": "A1_ARTIKEL_BESTIMMT",
  "title": "Tại quán cà phê ở Berlin",
  "context_desc": "Bạn đang gọi đồ uống và đồ ăn nhẹ tại một quán cà phê ở trung tâm Berlin.",
  "grammar_focus": "Sử dụng đúng quán từ xác định và trợ từ muốn (möchten).",
  "dialogue": [
    {
      "speaker": "Kellner (Bồi bàn)",
      "text": "Guten Tag! Was möchten Sie bestellen?",
      "vi": "Xin chào! Quý khách muốn gọi món gì ạ?"
    },
    {
      "speaker": "Du (Bạn)",
      "text": "Guten Tag! Ich möchte bitte den Kaffee und das Croissant.",
      "vi": "Xin chào! Cho tôi xin một cà phê và một bánh sừng bò."
    },
    {
      "speaker": "Kellner",
      "text": "Sehr gerne! Ist die Lampe hier zu hell?",
      "vi": "Rất sẵn lòng! Cây đèn ở đây có sáng quá không ạ?"
    },
    {
      "speaker": "Du",
      "text": "Nein, danke. Der Tisch ist perfekt.",
      "vi": "Không sao đâu, cảm ơn bạn. Chiếc bàn này rất hoàn hảo."
    }
  ],
  "order_index": 1
}
```

---

### 2.4. Bài tập tương tác (`grammar_exercises`)

Hỗ trợ 4 định dạng bài tập chuẩn quốc tế:
1. `choice`: Trắc nghiệm 4 đáp án.
2. `fill_blank`: Điền khuyết vào chỗ trống.
3. `reorder`: Sắp xếp các từ thành câu đúng trật tự ngữ pháp Đức.
4. `translate`: Dịch ngữ cảnh từ Việt sang Đức.

#### Cấu trúc trường:
- `topic_code` *(string)*: Mã chủ đề.
- `type` *(enum: choice | fill_blank | reorder | translate)*: Dạng bài tập.
- `prompt` *(string)*: Đề bài câu hỏi (có thể dùng `[...]` làm chỗ khuyết).
- `options` *(array of strings, áp dụng cho choice hoặc reorder)*: Các phương án lựa chọn.
- `solution` *(string)*: Đáp án đúng tuyệt đối.
- `explanation` *(string)*: Giải thích ngữ pháp chi tiết tại sao chọn đáp án đó.

#### Mẫu 4 dạng bài tập:

```json
[
  {
    "topic_code": "A1_ARTIKEL_BESTIMMT",
    "type": "choice",
    "prompt": "Chọn quán từ thích hợp: '[...] Tisch ist sehr modern.' (cái bàn)",
    "options": ["Der", "Die", "Das", "Den"],
    "solution": "Der",
    "explanation": "'Tisch' là danh từ giống đực (Maskulin), đóng vai trò chủ ngữ trong câu cách Nominativ nên dùng 'Der'."
  },
  {
    "topic_code": "A1_ARTIKEL_BESTIMMT",
    "type": "fill_blank",
    "prompt": "Điền quán từ thích hợp: '[...] Lampe ist neu.' (cây đèn)",
    "options": [],
    "solution": "Die",
    "explanation": "'Lampe' kết thúc bằng đuôi -e thường là danh từ giống cái (Feminin), quán từ cách Nominativ là 'Die'."
  },
  {
    "topic_code": "A1_VERBKONJUGATION",
    "type": "reorder",
    "prompt": "Sắp xếp các từ sau thành câu hoàn chỉnh:",
    "options": ["trinke", "Ich", "Kaffee", "gerne"],
    "solution": "Ich trinke gerne Kaffee",
    "explanation": "Trong câu trần thuật tiếng Đức, động từ đã chia luôn đứng ở vị trí thứ 2 (V2 rule)."
  },
  {
    "topic_code": "A1_NOMINATIV_AKKUSATIV",
    "type": "choice",
    "prompt": "Ich habe [...] Hund. (Tôi có một con chó - giống đực)",
    "options": ["einen", "ein", "eine", "einem"],
    "solution": "einen",
    "explanation": "Động từ 'haben' đi kèm tân ngữ trực tiếp ở cách Akkusativ. Quán từ bất định giống đực chuyển từ 'ein' thành 'einen'."
  }
]
```

---

## 3. MẪU DỮ LIỆU HOÀN CHỈNH NẠP LÊN SUPABASE (SQL SCRIPT)

Nếu bạn muốn nạp trực tiếp qua Supabase SQL Editor:

```sql
-- 1. Thêm từ vựng mới
INSERT INTO public.words (german, vietnamese, ipa, category, part_of_speech, example, example_vi)
VALUES 
  ('das Flugzeug', 'máy bay', '[ˈfluːkˌtsɔɪ̯k]', 'du lịch', 'noun', 'Das Flugzeug fliegt nach Frankfurt.', 'Máy bay bay đến Frankfurt.'),
  ('die Fahrkarte', 'vé xe / vé tàu', '[ˈfaːɐ̯ˌkaʁtə]', 'du lịch', 'noun', 'Wo kann ich eine Fahrkarte kaufen?', 'Tôi có thể mua vé ở đâu?')
ON CONFLICT (german) DO UPDATE 
SET vietnamese = EXCLUDED.vietnamese,
    example = EXCLUDED.example;

-- 2. Thêm kịch bản tình huống ngữ pháp
INSERT INTO public.grammar_scenarios (topic_id, title, context_desc, grammar_focus, dialogue)
SELECT 
  id, 
  'Hỏi đường tại nhà ga', 
  'Hỏi nhân viên đường sắt để mua vé tàu đi München', 
  'Câu hỏi đảo ngữ và động từ khuyết thiếu können',
  '[
    {"speaker": "Du", "text": "Entschuldigung, kann ich hier eine Fahrkarte kaufen?", "vi": "Xin lỗi, tôi có thể mua vé ở đây không?"},
    {"speaker": "Beamter", "text": "Ja, natürlich. Wohin möchten Sie fahren?", "vi": "Vâng, dĩ nhiên. Quý khách muốn đi đâu ạ?"}
  ]'::jsonb
FROM public.grammar_topics WHERE code = 'A1_MODALVERBEN';
```
