import type { FuzzyCheckResult } from '@/types'

/**
 * Clean and normalize a string (lowercase, trim extra spaces, normalize quotes)
 */
export function normalizeText(text: string): string {
  if (!text) return ''
  return text
    .toLowerCase()
    .trim()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
}

/**
 * Strip German Umlauts (ä->ae, ö->oe, ü->ue, ß->ss) for spelling tolerance
 */
export function stripGermanUmlauts(text: string): string {
  if (!text) return ''
  return text
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

/**
 * Standard Levenshtein Distance implementation
 */
export function levenshteinDistance(s1: string, s2: string): number {
  const a = normalizeText(s1)
  const b = normalizeText(s2)

  if (a === b) return 0
  if (a.length === 0) return b.length
  if (b.length === 0) return a.length

  const matrix: number[][] = []

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }

  return matrix[b.length][a.length]
}

/**
 * Remove German articles (der, die, das, ein, eine) if user typed only the noun
 */
export function stripArticle(text: string): string {
  return text.replace(/^(der|die|das|den|dem|des|ein|eine|einen|einem|einer)\s+/i, '').trim()
}

/**
 * Fuzzy check user's answer against the target German word
 * - Exact match (ignoring leading article or case): correct
 * - Missing Umlaut (ä/ö/ü/ß) or 1 character typo: typo warning ("Gần đúng rồi, chú ý Umlaut ä, ö, ü hoặc ß!")
 * - Otherwise: incorrect
 */
export function evaluateAnswer(userAnswer: string, expectedAnswer: string): FuzzyCheckResult {
  const normUser = normalizeText(userAnswer)
  const normExpected = normalizeText(expectedAnswer)

  if (!normUser) {
    return {
      status: 'incorrect',
      message: 'Vui lòng nhập câu trả lời.',
      distance: normExpected.length
    }
  }

  // Exact match
  if (normUser === normExpected) {
    return {
      status: 'correct',
      message: 'Chính xác hoàn toàn! Sehr gut!',
      distance: 0
    }
  }

  // Allow match without German article (e.g., expected "der Tisch", user typed "tisch")
  const userNoArticle = stripArticle(normUser)
  const expectedNoArticle = stripArticle(normExpected)
  if (userNoArticle === expectedNoArticle && userNoArticle.length > 0) {
    return {
      status: 'correct',
      message: 'Chính xác!',
      distance: 0
    }
  }

  // Check 1: German Umlaut difference (ä/ae, ö/oe, ü/ue, ß/ss)
  const umlautUser = stripGermanUmlauts(normUser)
  const umlautExpected = stripGermanUmlauts(normExpected)

  if (umlautUser === umlautExpected) {
    return {
      status: 'typo',
      message: 'Gần đúng rồi, chú ý ký tự Umlaut (ä, ö, ü hoặc ß)!',
      distance: 1,
      isAccentTypo: true
    }
  }

  // Check 2: Levenshtein distance === 1 (lệch 1 ký tự)
  const distance = levenshteinDistance(normUser, normExpected)
  if (distance === 1) {
    return {
      status: 'typo',
      message: 'Gần đúng rồi, bạn sai chính tả nhẹ 1 ký tự!',
      distance: 1,
      isAccentTypo: false
    }
  }

  // Check 3: Distance 1 on bare noun
  const bareDist = levenshteinDistance(userNoArticle, expectedNoArticle)
  if (bareDist === 1 && expectedNoArticle.length >= 3) {
    return {
      status: 'typo',
      message: 'Gần đúng rồi, chú ý chính tả nhẹ!',
      distance: 1,
      isAccentTypo: false
    }
  }

  return {
    status: 'incorrect',
    message: 'Chưa chính xác!',
    distance
  }
}

/**
 * Helper to mask the keyword in a German example sentence for Cloze Test
 * Returns masked sentence (with `[...]`) and whether the word was found.
 */
export function maskSentence(
  sentence: string,
  targetWord: string
): { maskedSentence: string; found: boolean } {
  if (!sentence || !targetWord) {
    return { maskedSentence: sentence || '', found: false }
  }

  // Remove article if noun
  const bareTarget = stripArticle(targetWord).trim()
  const escaped = bareTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Check word with German declension endings (-e, -en, -er, -es, -s, -t, -te)
  const regex = new RegExp(`(?<=^|\\s|'|’|\\()${escaped}(e|en|er|es|s|t|te|ten)?(?=[.,!?;:\\s'’\\)]|$)`, 'i')
  if (regex.test(sentence)) {
    return {
      maskedSentence: sentence.replace(regex, '[ ... ]'),
      found: true
    }
  }

  // Fallback: direct case-insensitive replacement
  const simpleRegex = new RegExp(escaped, 'i')
  if (simpleRegex.test(sentence)) {
    return {
      maskedSentence: sentence.replace(simpleRegex, '[ ... ]'),
      found: true
    }
  }

  return {
    maskedSentence: `${sentence} (Từ cần điền: [ ... ])`,
    found: false
  }
}
