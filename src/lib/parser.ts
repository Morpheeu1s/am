import type { Word } from '@/types'
import { getTodayDateString } from '@/lib/srs'

/**
 * Intelligent delimiter detector for TSV/CSV text
 */
export function detectDelimiter(text: string): '\t' | ';' | ',' {
  const firstLines = text.split('\n').slice(0, 5).join('\n')
  const tabCount = (firstLines.match(/\t/g) || []).length
  const semicolonCount = (firstLines.match(/;/g) || []).length
  const commaCount = (firstLines.match(/,/g) || []).length

  if (tabCount >= semicolonCount && tabCount >= commaCount && tabCount > 0) {
    return '\t'
  }
  if (semicolonCount > commaCount && semicolonCount > 0) {
    return ';'
  }
  return ','
}

/**
 * Parse a CSV/TSV line respecting quotes
 */
function parseDelimitedLine(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++ // Skip escaped quote
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  result.push(current.trim())
  return result
}

/**
 * Parse raw text (Anki TSV, CSV, or pasted text) into German word items
 */
export function parseImportData(rawText: string, forcedDelimiter?: '\t' | ';' | ','): Omit<Word, 'id'>[] {
  if (!rawText || !rawText.trim()) return []

  const delimiter = forcedDelimiter || detectDelimiter(rawText)
  const lines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#'))

  if (lines.length === 0) return []

  const words: Omit<Word, 'id'>[] = []
  const today = getTodayDateString()

  // Check if first line is a header
  const firstRow = parseDelimitedLine(lines[0], delimiter).map((col) => col.toLowerCase())
  const hasHeader =
    firstRow.some((col) => col.includes('german') || col.includes('deutsch') || col.includes('word') || col.includes('french')) ||
    firstRow.some((col) => col.includes('vietnamese') || col.includes('meaning') || col.includes('dịch'))

  const startIndex = hasHeader ? 1 : 0

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseDelimitedLine(lines[i], delimiter)
    if (cols.length === 0 || !cols[0]) continue

    const german = cols[0] || ''
    let ipa = ''
    let vietnamese = ''
    let category = 'giao tiếp'
    let example = ''
    let exampleVi = ''

    if (cols.length === 2) {
      vietnamese = cols[1] || ''
    } else if (cols.length === 3) {
      if (cols[1].startsWith('/') || cols[1].startsWith('[')) {
        ipa = cols[1]
        vietnamese = cols[2]
      } else {
        vietnamese = cols[1]
        example = cols[2]
      }
    } else if (cols.length === 4) {
      ipa = cols[1].startsWith('/') || cols[1].startsWith('[') ? cols[1] : ''
      vietnamese = cols[2] || cols[1]
      example = cols[3] || ''
    } else if (cols.length >= 5) {
      ipa = cols[1] || ''
      vietnamese = cols[2] || ''
      category = cols[3] || 'giao tiếp'
      example = cols[4] || ''
      exampleVi = cols[5] || ''
    }

    // Clean IPA formatting
    if (ipa && !ipa.startsWith('[') && !ipa.startsWith('/')) {
      ipa = `[${ipa}]`
    }

    if (german) {
      words.push({
        german,
        french: german,
        ipa,
        vietnamese,
        category,
        example,
        exampleVi,
        repetition: 0,
        interval: 0,
        easeFactor: 2.5,
        dueDate: today,
        mistakes: 0,
        createdAt: Date.now()
      })
    }
  }

  return words
}

/**
 * Export words to Anki TSV format
 */
export function exportToAnkiTSV(words: Word[]): string {
  const header = '# Anki Deck Export from Ambitieux German (Goethe A1)\n# German\tIPA\tVietnamese\tCategory\tExample\tExampleVi\n'
  const rows = words.map((w) =>
    [w.german || w.french || '', w.ipa || '', w.vietnamese || '', w.category || '', w.example || '', w.exampleVi || ''].join('\t')
  )
  return header + rows.join('\n')
}

/**
 * Export words to CSV format
 */
export function exportToCSV(words: Word[]): string {
  const header = 'German,IPA,Vietnamese,Category,Example,ExampleVi,Repetition,Interval,EaseFactor,DueDate,Mistakes\n'
  const rows = words.map((w) => {
    const escape = (str: string | number) => `"${String(str || '').replace(/"/g, '""')}"`
    return [
      escape(w.german || w.french || ''),
      escape(w.ipa || ''),
      escape(w.vietnamese),
      escape(w.category || ''),
      escape(w.example || ''),
      escape(w.exampleVi || ''),
      w.repetition,
      w.interval,
      w.easeFactor,
      escape(w.dueDate),
      w.mistakes
    ].join(',')
  })
  return header + rows.join('\n')
}

/**
 * Export words to JSON format (full database dump)
 */
export function exportToJSON(words: Word[]): string {
  return JSON.stringify(words, null, 2)
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
