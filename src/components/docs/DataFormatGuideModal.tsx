import { useState } from 'react'
import {
  BookOpen,
  FileCode,
  Copy,
  Check,
  FileText,
  Sparkles,
  Layers,
  Database
} from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { playFeedback } from '@/lib/audio'

interface DataFormatGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

type GuideTab = 'vocab' | 'grammar' | 'sql'

const SAMPLE_TSV = `der Tisch\t[tɪʃ]\tcái bàn\tnhà ở\tDer Tisch ist neu.\tCái bàn này còn mới.
die Lampe\t[ˈlampə]\tcây đèn\tnhà ở\tDie Lampe ist hell.\tCây đèn rất sáng.
trinken\t[ˈtʁɪŋkn̩]\tuống\tăn uống\tIch trinke Wasser.\tTôi uống nước lọc.
das Buch\t[buːx]\tcuốn sách\thọc tập\tDas Buch ist interessant.\tCuốn sách này rất hay.`

const SAMPLE_CSV = `german,ipa,vietnamese,category,example,example_vi
"der Tisch","[tɪʃ]","cái bàn","nhà ở","Der Tisch ist neu.","Cái bàn này còn mới."
"die Lampe","[ˈlampə]","cây đèn","nhà ở","Die Lampe ist hell.","Cây đèn rất sáng."
"trinken","[ˈtʁɪŋkn̩]","uống","ăn uống","Ich trinke Wasser.","Tôi uống nước lọc."`

const SAMPLE_JSON_VOCAB = `[
  {
    "german": "das Flugzeug",
    "ipa": "[ˈfluːkˌtsɔɪ̯k]",
    "vietnamese": "máy bay",
    "category": "du lịch",
    "example": "Das Flugzeug fliegt nach Frankfurt.",
    "example_vi": "Máy bay bay đến Frankfurt."
  }
]`

const SAMPLE_JSON_GRAMMAR = `{
  "topic_code": "A1_ARTIKEL",
  "scenario": {
    "title": "Tại quán cà phê ở Berlin",
    "context_desc": "Bạn đang gọi đồ uống và đồ ăn nhẹ tại quán cà phê.",
    "grammar_focus": "Sử dụng đúng quán từ der, die, das và thể muốn (möchten).",
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
      }
    ]
  },
  "exercises": [
    {
      "type": "choice",
      "prompt": "Chọn quán từ đúng: '[...] Tisch ist neu.'",
      "options": ["Der", "Die", "Das", "Den"],
      "solution": "Der",
      "explanation": "'Tisch' là danh từ giống đực cách Nominativ."
    },
    {
      "type": "fill_blank",
      "prompt": "Điền quán từ: '[...] Lampe ist hell.'",
      "options": [],
      "solution": "Die",
      "explanation": "'Lampe' là danh từ giống cái (Feminin)."
    }
  ]
}`

const SAMPLE_SQL = `-- 1. Thêm từ vựng tiếng Đức vào Supabase
INSERT INTO public.words (german, vietnamese, ipa, category, example, example_vi)
VALUES 
  ('die Fahrkarte', 'vé xe / vé tàu', '[ˈfaːɐ̯ˌkaʁtə]', 'du lịch', 'Wo kann ich eine Fahrkarte kaufen?', 'Tôi có thể mua vé ở đâu?')
ON CONFLICT (german) DO UPDATE 
SET vietnamese = EXCLUDED.vietnamese;

-- 2. Thêm tình huống hội thoại ngữ pháp
INSERT INTO public.grammar_scenarios (topic_id, title, context_desc, grammar_focus, dialogue)
SELECT 
  id, 
  'Hỏi đường tại Berlin', 
  'Hỏi đường đến ga tàu điện ngầm', 
  'Câu hỏi đảo ngữ và giới từ chỉ nơi chốn',
  '[
    {"speaker": "Du", "text": "Entschuldigung, wo ist die U-Bahn?", "vi": "Xin lỗi, ga tàu điện ngầm ở đâu?"},
    {"speaker": "Passant", "text": "Geradeaus und dann links.", "vi": "Đi thẳng rồi rẽ trái nhé."}
  ]'::jsonb
FROM public.grammar_topics WHERE code = 'A1_ARTIKEL';`

export function DataFormatGuideModal({ isOpen, onClose }: DataFormatGuideModalProps) {
  const [activeTab, setActiveTab] = useState<GuideTab>('vocab')
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const copyToClipboard = (text: string, key: string) => {
    playFeedback('click')
    navigator.clipboard.writeText(text).then(() => {
      setCopiedKey(key)
      setTimeout(() => setCopiedKey(null), 2500)
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Chuẩn hóa định dạng nạp dữ liệu"
      description="Hướng dẫn quy cách format file và JSON để tải lên Supabase & Ambitieux"
    >
      <div className="space-y-4 mt-2">
        {/* Segmented Pill Tabs */}
        <div
          style={{ borderRadius: 9999 }}
          className="flex items-center gap-1 p-1 bg-[#131314] border border-[#303336] text-xs"
        >
          <button
            onClick={() => setActiveTab('vocab')}
            style={{ borderRadius: 9999 }}
            className={`flex-1 py-1.5 px-3 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'vocab'
                ? 'bg-[#004a77] text-[#c2e7ff] shadow-sm'
                : 'text-[#c4c7c5] hover:text-white'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Từ vựng</span>
          </button>

          <button
            onClick={() => setActiveTab('grammar')}
            style={{ borderRadius: 9999 }}
            className={`flex-1 py-1.5 px-3 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'grammar'
                ? 'bg-[#004a77] text-[#c2e7ff] shadow-sm'
                : 'text-[#c4c7c5] hover:text-white'
            }`}
          >
            <Layers className="h-3.5 w-3.5" />
            <span>Ngữ pháp & Kịch bản</span>
          </button>

          <button
            onClick={() => setActiveTab('sql')}
            style={{ borderRadius: 9999 }}
            className={`flex-1 py-1.5 px-3 font-semibold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'sql'
                ? 'bg-[#004a77] text-[#c2e7ff] shadow-sm'
                : 'text-[#c4c7c5] hover:text-white'
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>SQL Supabase</span>
          </button>
        </div>

        {/* Tab 1: Từ vựng */}
        {activeTab === 'vocab' && (
          <div className="space-y-3.5 text-xs sm:text-sm animate-in fade-in duration-200">
            <div className="p-3 rounded-2xl bg-[#1e1f20] border border-[#3c4043] space-y-1.5">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-[#a8c7fa]" />
                Quy tắc chuẩn hóa từ vựng tiếng Đức:
              </div>
              <ul className="text-xs text-[#c4c7c5] space-y-1 list-disc list-inside">
                <li>
                  <strong className="text-white">Danh từ</strong> bắt buộc <strong>viết hoa</strong> chữ cái đầu và nên kèm quán từ (ví dụ: <code className="text-[#a8c7fa]">der Tisch</code>, <code className="text-[#a8c7fa]">die Lampe</code>).
                </li>
                <li>Phiên âm IPA đặt trong cặp ngoặc vuông <code className="text-[#a8c7fa]">[tɪʃ]</code>.</li>
                <li>Chủ đề đặt chữ thường: <code className="text-[#c4eed0]">giao tiếp, ăn uống, nhà ở, du lịch</code>.</li>
              </ul>
            </div>

            {/* Sub-format 1: TSV / Tab-separated */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#e3e3e3] flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-[#a8c7fa]" />
                  1. Mẫu TSV (Anki & Dán bảng Text)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SAMPLE_TSV, 'tsv')}
                  className="text-xs text-[#a8c7fa] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'tsv' ? <Check className="h-3.5 w-3.5 text-[#34a853]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'tsv' ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-2xl bg-[#131314] border border-[#303336] text-[11px] font-mono text-[#c4c7c5] overflow-x-auto whitespace-pre leading-relaxed">
                {SAMPLE_TSV}
              </pre>
            </div>

            {/* Sub-format 2: CSV */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#e3e3e3] flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-[#c4eed0]" />
                  2. Mẫu CSV (Excel / Google Sheets)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SAMPLE_CSV, 'csv')}
                  className="text-xs text-[#a8c7fa] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'csv' ? <Check className="h-3.5 w-3.5 text-[#34a853]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'csv' ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-2xl bg-[#131314] border border-[#303336] text-[11px] font-mono text-[#c4c7c5] overflow-x-auto whitespace-pre leading-relaxed">
                {SAMPLE_CSV}
              </pre>
            </div>

            {/* Sub-format 3: JSON */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#e3e3e3] flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5 text-[#ffe082]" />
                  3. Mẫu JSON (Supabase Bulk)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SAMPLE_JSON_VOCAB, 'json_vocab')}
                  className="text-xs text-[#a8c7fa] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'json_vocab' ? <Check className="h-3.5 w-3.5 text-[#34a853]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'json_vocab' ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-2xl bg-[#131314] border border-[#303336] text-[11px] font-mono text-[#c4c7c5] overflow-x-auto whitespace-pre leading-relaxed">
                {SAMPLE_JSON_VOCAB}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Ngữ pháp & Kịch bản */}
        {activeTab === 'grammar' && (
          <div className="space-y-3.5 text-xs sm:text-sm animate-in fade-in duration-200">
            <div className="p-3 rounded-2xl bg-[#1e1f20] border border-[#3c4043] space-y-1.5">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-[#c084fc]" />
                Cấu trúc phân tầng Ngữ pháp & Tình huống:
              </div>
              <p className="text-xs text-[#c4c7c5] leading-relaxed">
                Bao gồm <strong>Chủ đề (Topic)</strong>, <strong>Tình huống hội thoại (Scenario)</strong> và <strong>4 dạng bài tập</strong> (<code className="text-[#a8c7fa]">choice</code> trắc nghiệm, <code className="text-[#a8c7fa]">fill_blank</code> điền chỗ trống, <code className="text-[#a8c7fa]">reorder</code> sắp xếp từ, <code className="text-[#a8c7fa]">translate</code> dịch câu).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#e3e3e3] flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-[#c084fc]" />
                  Mẫu JSON Kịch bản tình huống & Bài tập:
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SAMPLE_JSON_GRAMMAR, 'grammar_json')}
                  className="text-xs text-[#a8c7fa] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'grammar_json' ? <Check className="h-3.5 w-3.5 text-[#34a853]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'grammar_json' ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-2xl bg-[#131314] border border-[#303336] text-[11px] font-mono text-[#c4c7c5] overflow-x-auto whitespace-pre leading-relaxed max-h-72">
                {SAMPLE_JSON_GRAMMAR}
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: SQL Script */}
        {activeTab === 'sql' && (
          <div className="space-y-3.5 text-xs sm:text-sm animate-in fade-in duration-200">
            <div className="p-3 rounded-2xl bg-[#1e1f20] border border-[#3c4043] space-y-1">
              <div className="font-semibold text-white flex items-center gap-1.5">
                <Database className="h-4 w-4 text-[#34a853]" />
                Chạy trực tiếp trong Supabase SQL Editor:
              </div>
              <p className="text-xs text-[#c4c7c5]">
                Dùng lệnh SQL <code className="text-[#34a853]">INSERT INTO public.words</code> để thêm hàng loạt từ vựng mới mà không sợ bị trùng lặp (<code className="text-[#34a853]">ON CONFLICT DO UPDATE</code>).
              </p>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#e3e3e3] flex items-center gap-1.5">
                  <FileCode className="h-3.5 w-3.5 text-[#34a853]" />
                  Mẫu SQL Script chèn dữ liệu:
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(SAMPLE_SQL, 'sql')}
                  className="text-xs text-[#a8c7fa] hover:text-white flex items-center gap-1 cursor-pointer"
                >
                  {copiedKey === 'sql' ? <Check className="h-3.5 w-3.5 text-[#34a853]" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedKey === 'sql' ? 'Đã sao chép' : 'Sao chép'}</span>
                </button>
              </div>
              <pre className="p-3 rounded-2xl bg-[#131314] border border-[#303336] text-[11px] font-mono text-[#c4c7c5] overflow-x-auto whitespace-pre leading-relaxed max-h-72">
                {SAMPLE_SQL}
              </pre>
            </div>
          </div>
        )}

        <div className="pt-2 flex justify-end">
          <Button
            variant="primary"
            size="md"
            onClick={onClose}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs sm:text-sm h-11"
          >
            Đã hiểu quy cách format
          </Button>
        </div>
      </div>
    </Modal>
  )
}
