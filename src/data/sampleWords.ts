import type { Word } from '@/types'
import vocabGoetheA1 from './vocab_goethe_a1.json'

// Take the top 20 sample words from Goethe A1 dataset
export const SAMPLE_WORDS: Omit<Word, 'id'>[] = (vocabGoetheA1 as unknown as Partial<Word>[])
  .slice(0, 20)
  .map((item) => {
    const germanWord = item.german || item.french || ''
    return {
      german: germanWord,
      french: germanWord,
      ipa: item.ipa || '',
      vietnamese: item.vietnamese || '',
      category: item.category || 'giao tiếp',
      example: item.example || '',
      exampleVi: item.exampleVi || '',
      repetition: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: item.dueDate || '2026-10-28',
      mistakes: 0,
      createdAt: Date.now()
    }
  })
