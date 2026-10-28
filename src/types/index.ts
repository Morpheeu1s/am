export interface Word {
  id?: number
  german: string
  french?: string // backward compatibility
  ipa?: string
  vietnamese: string
  category?: string
  example?: string
  exampleVi?: string
  repetition: number
  interval: number
  easeFactor: number
  dueDate: string // YYYY-MM-DD
  mistakes: number
  createdAt?: number
}

export type ReviewQuality = 0 | 1 | 2 | 3 | 4 | 5

// Multi-modal interactive exercise types (5 distinct stages per word)
export type ExerciseType =
  | 'new_intro'
  | 'choice'           // Đức ➜ Việt (Trắc nghiệm chọn nghĩa tiếng Việt)
  | 'reverse_choice'   // Việt ➜ Đức (Trắc nghiệm chọn từ tiếng Đức từ nghĩa Việt)
  | 'article_quiz'     // Chọn mạo từ chuẩn der / die / das cho danh từ
  | 'listening_choice' // Nghe âm thanh ➜ Chọn nghĩa đúng
  | 'scramble'         // Xếp mảnh chữ / ký tự (Duolingo style)
  | 'reverse'          // Dịch ngược Việt ➜ Gõ từ tiếng Đức
  | 'dictee'           // Nghe phát âm ➜ Chép chính tả tiếng Đức
  | 'cloze'            // Điền từ tiếng Đức còn thiếu vào câu ngữ cảnh

export interface StudyTask {
  word: Word
  exerciseType: ExerciseType
  round: number // 1 to 4
  totalRounds: number // 4
}

export interface SRSResult {
  repetition: number
  interval: number
  easeFactor: number
  dueDate: string
  mistakes: number
}

export interface FuzzyCheckResult {
  status: 'correct' | 'typo' | 'incorrect'
  message?: string
  distance: number
  isAccentTypo?: boolean
}

export interface DeckStats {
  total: number
  dueToday: number
  newInPool: number
  mastered: number
  learning: number
  levelCounts: {
    level0: number // Chưa học
    level1: number // Khởi đầu
    level2: number // Đang nhớ
    level3: number // Khắc sâu
    level4: number // Thành thạo
  }
}

export interface StudyConfig {
  newWordsPerBatch: number // default 10
  speechRate: number // default 1.0
}
