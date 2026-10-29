import Dexie, { type Table } from 'dexie'
import type { Word, DeckStats } from '@/types'
import vocabGoetheA1 from '@/data/vocab_goethe_a1.json'
import { getTodayDateString } from '@/lib/srs'
import { getSupabaseClient } from '@/lib/supabase'

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
 * Syncs seamlessly with Supabase backend when online.
 */
export async function initializeDefaultData(): Promise<void> {
  const supabase = getSupabaseClient()
  const today = getTodayDateString()

  // 1. Try to sync with Supabase if online
  if (supabase) {
    try {
      const { data, error } = await supabase.from('words').select('*').limit(1000)
      if (!error && data) {
        if (data.length > 0) {
          // Supabase has data: update local IndexedDB with cloud source of truth
          const remoteWords: Word[] = data.map((remote) => ({
            id: remote.id,
            german: remote.german,
            french: remote.german,
            ipa: remote.ipa || '',
            vietnamese: remote.vietnamese,
            category: remote.category || 'chung',
            example: remote.example || '',
            exampleVi: remote.example_vi || '',
            repetition: remote.repetition ?? 0,
            interval: remote.interval ?? 0,
            easeFactor: Number(remote.ease_factor) || 2.5,
            dueDate: remote.due_date || today,
            mistakes: remote.mistakes ?? 0
          }))

          await db.words.clear()
          await db.words.bulkAdd(remoteWords)
          return
        } else {
          // Supabase table exists but is empty -> auto seed to Supabase
          const entries: Word[] = (vocabGoetheA1 as unknown as Partial<Word>[]).map((item) =>
            normalizeWordEntry(item, today)
          )
          const payload = entries.map((w) => ({
            german: w.german,
            vietnamese: w.vietnamese,
            ipa: w.ipa || '',
            category: w.category || 'chung',
            example: w.example || '',
            example_vi: w.exampleVi || '',
            repetition: 0,
            interval: 0,
            ease_factor: 2.5,
            due_date: today,
            mistakes: 0
          }))
          // Push in chunks
          for (let i = 0; i < payload.length; i += 100) {
            await supabase.from('words').upsert(payload.slice(i, i + 100), { onConflict: 'german' })
          }
        }
      }
    } catch {
      // Supabase table not created yet or network unavailable, continue to local Dexie
    }
  }

  // 2. Ensure local Dexie has data
  const count = await db.words.count()
  if (count === 0) {
    const entries: Word[] = (vocabGoetheA1 as unknown as Partial<Word>[]).map((item) =>
      normalizeWordEntry(item, today)
    )
    await db.words.bulkAdd(entries)
    console.log(`Ambitieux: Seeded ${entries.length} Goethe A1 words locally.`)
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
 * Add a new word (saves locally and syncs to Supabase)
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

  const localId = await db.words.add(wordWithDefaults)

  // Sync to Supabase
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      await supabase.from('words').upsert({
        german: germanWord,
        vietnamese: wordWithDefaults.vietnamese,
        ipa: wordWithDefaults.ipa,
        category: wordWithDefaults.category,
        example: wordWithDefaults.example || '',
        example_vi: wordWithDefaults.exampleVi || '',
        repetition: wordWithDefaults.repetition,
        interval: wordWithDefaults.interval,
        ease_factor: wordWithDefaults.easeFactor,
        due_date: wordWithDefaults.dueDate,
        mistakes: wordWithDefaults.mistakes
      }, { onConflict: 'german' })
    } catch {
      // Offline resilient
    }
  }

  return localId
}

/**
 * Update an existing word (updates locally and syncs to Supabase)
 */
export async function updateWord(id: number, changes: Partial<Word>): Promise<number> {
  const updatedChanges = { ...changes }
  if (changes.german) {
    updatedChanges.french = changes.german
  } else if (changes.french) {
    updatedChanges.german = changes.french
  }

  const result = await db.words.update(id, updatedChanges)

  // Sync update to Supabase
  const supabase = getSupabaseClient()
  if (supabase) {
    try {
      const word = await db.words.get(id)
      if (word) {
        const updatePayload: Record<string, unknown> = {}
        if (changes.repetition !== undefined) updatePayload.repetition = changes.repetition
        if (changes.interval !== undefined) updatePayload.interval = changes.interval
        if (changes.easeFactor !== undefined) updatePayload.ease_factor = changes.easeFactor
        if (changes.dueDate !== undefined) updatePayload.due_date = changes.dueDate
        if (changes.mistakes !== undefined) updatePayload.mistakes = changes.mistakes
        if (changes.vietnamese !== undefined) updatePayload.vietnamese = changes.vietnamese
        if (changes.german !== undefined) updatePayload.german = changes.german
        if (changes.example !== undefined) updatePayload.example = changes.example
        if (changes.exampleVi !== undefined) updatePayload.example_vi = changes.exampleVi
        if (changes.category !== undefined) updatePayload.category = changes.category
        if (changes.ipa !== undefined) updatePayload.ipa = changes.ipa

        await supabase.from('words').update(updatePayload).eq('german', word.german)
      }
    } catch {
      // Offline resilient
    }
  }

  return result
}

/**
 * Delete a word by id (deletes locally and syncs to Supabase)
 */
export async function deleteWord(id: number): Promise<void> {
  const word = await db.words.get(id)
  await db.words.delete(id)

  const supabase = getSupabaseClient()
  if (supabase && word) {
    try {
      await supabase.from('words').delete().eq('german', word.german)
    } catch {
      // Offline resilient
    }
  }
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

    // Sync to Supabase
    const supabase = getSupabaseClient()
    if (supabase) {
      const payload = toAdd.map((w) => ({
        german: w.german,
        vietnamese: w.vietnamese,
        ipa: w.ipa || '',
        category: w.category || 'chung',
        example: w.example || '',
        example_vi: w.exampleVi || '',
        repetition: w.repetition,
        interval: w.interval,
        ease_factor: w.easeFactor,
        due_date: w.dueDate,
        mistakes: w.mistakes
      }))
      supabase.from('words').upsert(payload, { onConflict: 'german' }).then(() => {}, () => {})
    }
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

  const supabase = getSupabaseClient()
  if (supabase) {
    const payload = entries.map((w) => ({
      german: w.german,
      vietnamese: w.vietnamese,
      ipa: w.ipa || '',
      category: w.category || 'chung',
      example: w.example || '',
      example_vi: w.exampleVi || '',
      repetition: 0,
      interval: 0,
      ease_factor: 2.5,
      due_date: today,
      mistakes: 0
    }))
    for (let i = 0; i < payload.length; i += 100) {
      await supabase.from('words').upsert(payload.slice(i, i + 100), { onConflict: 'german' }).then(() => {}, () => {})
    }
  }
}

// Backward compatibility alias
export const resetDatabaseToSample = resetDatabaseToDefault

/**
 * Clear all words
 */
export async function clearAllWords(): Promise<void> {
  await db.words.clear()
}
