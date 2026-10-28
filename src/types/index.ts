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

// Auto-mixed exercise types (inspired by 4English / Duolingo / Anki)
export type ExerciseType = 'new_intro' | 'choice' | 'dictee' | 'reverse' | 'cloze'

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
