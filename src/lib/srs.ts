import type { Word, ReviewQuality, SRSResult, StudyConfig } from '@/types'

/**
 * Format Date object to YYYY-MM-DD
 */
export function formatDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * Get today's date in YYYY-MM-DD format
 */
export function getTodayDateString(): string {
  return formatDate(new Date())
}

/**
 * Add days to a given YYYY-MM-DD date string
 */
export function addDays(dateStr: string, days: number): string {
  const [year, month, day] = dateStr.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return formatDate(date)
}

/**
 * Mastery Level structure in Material 3 / Google Labs style
 */
export interface MasteryInfo {
  level: number
  label: string
  shortLabel: string
  badgeClass: string
  color: string
}

export function getMasteryInfo(repetition: number): MasteryInfo {
  if (repetition <= 0) {
    return {
      level: 0,
      label: 'Kho từ (Chưa học)',
      shortLabel: 'Lvl 0',
      badgeClass: 'bg-[#282a2c] text-[#8e918f] border-[#444746]/60',
      color: '#8e918f'
    }
  }
  if (repetition === 1) {
    return {
      level: 1,
      label: 'Khởi đầu',
      shortLabel: 'Lvl 1',
      badgeClass: 'bg-[#004a77]/60 text-[#c2e7ff] border-[#004a77]',
      color: '#a8c7fa'
    }
  }
  if (repetition <= 3) {
    return {
      level: 2,
      label: 'Đang nhớ',
      shortLabel: 'Lvl 2',
      badgeClass: 'bg-[#394457]/60 text-[#d3e3fd] border-[#4f5b72]',
      color: '#c2e7ff'
    }
  }
  if (repetition <= 5) {
    return {
      level: 3,
      label: 'Khắc sâu',
      shortLabel: 'Lvl 3',
      badgeClass: 'bg-[#5c3e00]/60 text-[#ffe082] border-[#7c5800]',
      color: '#ffe082'
    }
  }
  return {
    level: 4,
    label: 'Thành thạo',
    shortLabel: 'Lvl 4 (Master)',
    badgeClass: 'bg-[#0f5223]/60 text-[#c4eed0] border-[#1e8e3e]',
    color: '#c4eed0'
  }
}

/**
 * SuperMemo-2 (SM-2) algorithm implementation
 * @param card Current flashcard
 * @param isCorrect Whether the answer is correct
 * @param quality Optional review rating (0-5)
 */
export function updateSRS(
  card: Word,
  isCorrect: boolean,
  quality: ReviewQuality | number = isCorrect ? 4 : 1
): SRSResult {
  let repetition = card.repetition ?? 0
  let interval = card.interval ?? 0
  let easeFactor = card.easeFactor ?? 2.5
  let mistakes = card.mistakes ?? 0

  if (!isCorrect || quality < 3) {
    // Trả lời sai (Again): repetition = 0, interval = 1, easeFactor = Math.max(1.3, easeFactor - 0.2)
    repetition = 0
    interval = 1
    easeFactor = Math.max(1.3, Number((easeFactor - 0.2).toFixed(2)))
    mistakes += 1
  } else {
    // Trả lời đúng (Good/Easy):
    if (repetition === 0) {
      interval = 1
    } else if (repetition === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easeFactor)
    }
    repetition = repetition + 1

    // Quality bonus
    if (quality === 5) {
      easeFactor = Number((easeFactor + 0.15).toFixed(2))
    }
  }

  const nextDueDate = addDays(getTodayDateString(), interval)

  return {
    repetition,
    interval,
    easeFactor,
    dueDate: nextDueDate,
    mistakes
  }
}

/**
 * Interval preview text helper for SRS action buttons
 */
export function getIntervalPreview(card: Word, quality: ReviewQuality): string {
  const preview = updateSRS(card, quality >= 3, quality)
  if (preview.interval === 1) return '1 ngày'
  return `${preview.interval} ngày`
}

const STORAGE_KEY_CONFIG = 'ambitieux_study_config'

/**
 * Load study batch configuration
 */
export function getStudyConfig(): StudyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        newWordsPerBatch: parsed.newWordsPerBatch || 10,
        speechRate: parsed.speechRate || 1.0
      }
    }
  } catch {
    // fallback
  }
  return {
    newWordsPerBatch: 10,
    speechRate: 1.0
  }
}

/**
 * Save study batch configuration
 */
export function saveStudyConfig(config: StudyConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config))
  } catch {
    // ignore
  }
}
