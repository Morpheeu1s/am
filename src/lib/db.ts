import Dexie, { type Table } from 'dexie'
import type { Word, DeckStats } from '@/types'
import vocabGoetheA1 from '@/data/vocab_goethe_a1.json'
import { getTodayDateString } from '@/lib/srs'

export class AmbitieuxDatabase extends Dexie {
  words!: Table<Word, number>

  constructor() {
    super('AmbitieuxGermanDB')
    this.version(1).stores({
      words: '++id, german, french, vietnamese, dueDate, category, repetition, interval, easeFactor, mistakes'
    })
  }
}

export const db = new AmbitieuxDatabase()

/**
 * Format raw imported item into valid Word entity
 */
function normalizeWordEntry(item: Partial<Word> & { german?: string; french?: string }, today: string): Word {
  const germanWord = item.german?.trim() || item.french?.trim() || ''
  return {
    german: germanWord,
    french: germanWord, // backward compatibility
    ipa: item.ipa?.trim() || '',
    vietnamese: item.vietnamese?.trim() || '',
    category: item.category?.trim() || 'chung',
    example: item.example?.trim() || '',
    exampleVi: item.exampleVi?.trim() || '',
    repetition: item.repetition ?? 0,
    interval: item.interval ?? 0,
    easeFactor: item.easeFactor ?? 2.5,
    dueDate: item.dueDate || today,
    mistakes: item.mistakes ?? 0,
    createdAt: item.createdAt || Date.now()
  }
}

/**
 * Check if words table is empty; if so, populate Goethe-Zertifikat A1 words
 * into the pool (repetition = 0).
 */
export async function initializeDefaultData(): Promise<void> {
  const count = await db.words.count()
  if (count === 0) {
    const today = getTodayDateString()
    const entries: Word[] = (vocabGoetheA1 as unknown as Partial<Word>[]).map((item) =>
      normalizeWordEntry(item, today)
    )
    await db.words.bulkAdd(entries)
    console.log(`Ambitieux: Seeded ${entries.length} Goethe A1 words successfully into the warehouse pool.`)
  }
}

// Backward compatibility alias
export const initializeDatabase = initializeDefaultData

/**
 * Fetch words that are due today or overdue (dueDate <= targetDate and already learned: repetition > 0)
 */
export async function getDueWords(targetDate = getTodayDateString()): Promise<Word[]> {
  return await db.words
    .filter((word) => word.repetition > 0 && word.dueDate <= targetDate)
    .toArray()
}

/**
 * Fetch a batch of new words from the warehouse pool (repetition === 0)
 */
export async function getNewWordsFromPool(count: number = 10): Promise<Word[]> {
  return await db.words
    .filter((word) => (word.repetition ?? 0) === 0)
    .limit(count)
    .toArray()
}

/**
 * Build a seamless study session:
 * Reviews (due cards: repetition > 0 & dueDate <= today) + New words from warehouse pool (repetition === 0)
 */
export async function getStudySessionWords(newWordsCount: number = 10): Promise<{
  sessionWords: Word[]
  reviewCount: number
  newCount: number
}> {
  const today = getTodayDateString()
  const reviewWords = await db.words
    .filter((w) => w.repetition > 0 && w.dueDate <= today)
    .toArray()

  const newWords = await db.words
    .filter((w) => (w.repetition ?? 0) === 0)
    .limit(newWordsCount)
    .toArray()

  // Interleave / mix review words with new words for optimal retention
  const sessionWords = [...reviewWords, ...newWords]

  return {
    sessionWords,
    reviewCount: reviewWords.length,
    newCount: newWords.length
  }
}

/**
 * Fetch all words sorted by id descending
 */
export async function getAllWords(): Promise<Word[]> {
  return await db.words.reverse().toArray()
}

/**
 * Get distinct list of categories
 */
export async function getCategories(): Promise<string[]> {
  const words = await db.words.toArray()
  const set = new Set<string>()
  for (const w of words) {
    if (w.category) set.add(w.category)
  }
  return Array.from(set).sort()
}

/**
 * Add a new word
 */
export async function addWord(word: Omit<Word, 'id'>): Promise<number> {
  const today = getTodayDateString()
  const germanWord = word.german?.trim() || word.french?.trim() || ''
  const wordWithDefaults: Word = {
    ...word,
    german: germanWord,
    french: germanWord,
    ipa: word.ipa?.trim() || '',
    vietnamese: word.vietnamese.trim(),
    category: word.category?.trim() || 'chung',
    repetition: word.repetition ?? 0,
    interval: word.interval ?? 0,
    easeFactor: word.easeFactor ?? 2.5,
    dueDate: word.dueDate || today,
    mistakes: word.mistakes ?? 0,
    createdAt: word.createdAt || Date.now()
  }
  return await db.words.add(wordWithDefaults)
}

/**
 * Update an existing word
 */
export async function updateWord(id: number, changes: Partial<Word>): Promise<number> {
  const updatedChanges = { ...changes }
  if (changes.german) {
    updatedChanges.french = changes.german
  } else if (changes.french) {
    updatedChanges.german = changes.french
  }
  return await db.words.update(id, updatedChanges)
}

/**
 * Delete a word by id
 */
export async function deleteWord(id: number): Promise<void> {
  await db.words.delete(id)
}

/**
 * Bulk add words (used by Import)
 */
export async function bulkAddWords(words: Omit<Word, 'id'>[]): Promise<number> {
  const existingWords = await db.words.toArray()
  const existingMap = new Set(existingWords.map((w) => (w.german || w.french || '').toLowerCase().trim()))

  const toAdd: Word[] = []
  const today = getTodayDateString()

  for (const w of words) {
    const cleanWord = (w.german || w.french || '').trim()
    if (!cleanWord || existingMap.has(cleanWord.toLowerCase())) {
      continue
    }
    existingMap.add(cleanWord.toLowerCase())
    toAdd.push({
      ...w,
      german: cleanWord,
      french: cleanWord,
      ipa: w.ipa || '',
      vietnamese: w.vietnamese || '',
      category: w.category || 'chung',
      example: w.example || '',
      exampleVi: w.exampleVi || '',
      repetition: w.repetition ?? 0,
      interval: w.interval ?? 0,
      easeFactor: w.easeFactor ?? 2.5,
      dueDate: w.dueDate || today,
      mistakes: w.mistakes ?? 0,
      createdAt: Date.now()
    })
  }

  if (toAdd.length > 0) {
    await db.words.bulkAdd(toAdd)
  }
  return toAdd.length
}

/**
 * Calculate deck statistics categorized by mastery levels
 */
export async function getDeckStats(): Promise<DeckStats> {
  const allWords = await db.words.toArray()
  const today = getTodayDateString()

  let dueToday = 0
  let newInPool = 0
  let mastered = 0
  let learning = 0

  const levelCounts = {
    level0: 0,
    level1: 0,
    level2: 0,
    level3: 0,
    level4: 0
  }

  for (const w of allWords) {
    const rep = w.repetition ?? 0

    if (rep === 0) {
      newInPool++
      levelCounts.level0++
    } else {
      if (w.dueDate <= today) {
        dueToday++
      }
      if (rep >= 6) {
        mastered++
        levelCounts.level4++
      } else if (rep >= 4) {
        learning++
        levelCounts.level3++
      } else if (rep >= 2) {
        learning++
        levelCounts.level2++
      } else {
        learning++
        levelCounts.level1++
      }
    }
  }

  return {
    total: allWords.length,
    dueToday,
    newInPool,
    mastered,
    learning,
    levelCounts
  }
}

/**
 * Reset database to default Goethe-Zertifikat A1 vocabulary
 */
export async function resetDatabaseToDefault(): Promise<void> {
  await db.words.clear()
  const today = getTodayDateString()
  const entries: Word[] = (vocabGoetheA1 as unknown as Partial<Word>[]).map((item) =>
    normalizeWordEntry(item, today)
  )
  await db.words.bulkAdd(entries)
}

// Backward compatibility alias
export const resetDatabaseToSample = resetDatabaseToDefault

/**
 * Clear all words
 */
export async function clearAllWords(): Promise<void> {
  await db.words.clear()
}
