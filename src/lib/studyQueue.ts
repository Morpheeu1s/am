import type { Word, ExerciseType, StudyTask } from '@/types'

/**
 * Check if a German word has an article (der / die / das)
 */
export function isGermanNoun(german: string): boolean {
  return /^(der|die|das)\s+/i.test(german.trim())
}

/**
 * Extract article and noun from a German noun string
 */
export function getGermanArticleAndNoun(german: string): {
  article: 'der' | 'die' | 'das'
  noun: string
} | null {
  const match = german.trim().match(/^(der|die|das)\s+(.*)$/i)
  if (!match) return null
  return {
    article: match[1].toLowerCase() as 'der' | 'die' | 'das',
    noun: match[2].trim()
  }
}

/**
 * Generate clickable scramble tiles for Duolingo-style word assembly
 */
export function generateScrambleTiles(german: string): {
  correctSequence: string[]
  shuffledTiles: string[]
} {
  const clean = german.trim()
  const words = clean.split(/\s+/)

  let correctSequence: string[] = []

  if (words.length >= 2) {
    // If it's a noun with article like "der Tisch", split article + syllables/chunks of the noun
    const [first, ...rest] = words
    const restStr = rest.join(' ')
    if (restStr.length > 4) {
      const mid = Math.ceil(restStr.length / 2)
      correctSequence = [first, restStr.slice(0, mid), restStr.slice(mid)]
    } else {
      correctSequence = [...words]
    }
  } else if (clean.length > 5) {
    // Break into chunks of 2-3 characters
    const chunks: string[] = []
    let i = 0
    while (i < clean.length) {
      const take = clean.length - i <= 4 && clean.length - i >= 2 ? clean.length - i : 2
      chunks.push(clean.slice(i, i + take))
      i += take
    }
    correctSequence = chunks
  } else {
    correctSequence = clean.split('')
  }

  // Add 2 plausible distractor tiles
  const distractorsPool = ['der', 'die', 'das', 'ein', 'ch', 'en', 'er', 'te', 'ung', 'st']
  const distractors = distractorsPool.filter((d) => !correctSequence.includes(d)).slice(0, 2)

  const allTiles = [...correctSequence, ...distractors]

  // Deterministic shuffle based on string characters so useMemo stays pure
  const seed = clean.split('').reduce((acc, ch, idx) => acc + ch.charCodeAt(0) * (idx + 17), 0)
  const shuffledTiles = [...allTiles].sort((a, b) => {
    const hashA = (a.charCodeAt(0) * 37 + a.length * 13 + seed) % 97
    const hashB = (b.charCodeAt(0) * 37 + b.length * 13 + seed) % 97
    return hashA - hashB
  })

  return {
    correctSequence,
    shuffledTiles
  }
}

/**
 * Builds an interleaved multi-modal queue where EVERY word is guaranteed 4 repetitions
 * across distinct interaction styles (including Speaking / Pronunciation):
 *
 * - Lần 1 (Nhận diện & Mạo từ):
 *   + Nếu là danh từ (có der/die/das): 'article_quiz' (Chọn mạo từ der/die/das)
 *   + Nếu là từ loại khác: 'choice' (Đức ➜ Việt) hoặc 'new_intro' (Khám phá từ mới)
 * - Lần 2 (Phản xạ Nghe & Dịch ngược Trắc nghiệm):
 *   + Luân phiên 'reverse_choice' (Nhìn nghĩa Việt ➜ Chọn từ Đức) và 'listening_choice' (Nghe phát âm ➜ Chọn nghĩa)
 * - Lần 3 (Luyện phát âm Giọng nói 🎙️ & Xếp mảnh chữ 🧩):
 *   + Luân phiên 'speaking' (Đọc to từ tiếng Đức để chấm phát âm + Shadowing nghe lại giọng mình) và 'scramble' (Xếp chữ Duolingo)
 * - Lần 4 (Chủ động Gõ Dịch ngược Việt ➜ Đức / Điền từ / Dictée):
 *   + Luân phiên 'reverse' (Nhìn tiếng Việt ➜ Gõ từ tiếng Đức), 'cloze' (Điền từ vào câu), và 'dictee' (Nghe chép chính tả)
 *
 * Tất cả các lượt được xáo trộn xen kẽ (Interleaved) để không bao giờ lặp lại cùng 1 từ liên tiếp.
 */
export function buildInterleavedStudyTasks(words: Word[]): StudyTask[] {
  if (words.length === 0) return []

  const totalRounds = 4
  const roundTasks: StudyTask[][] = [[], [], [], []]

  words.forEach((word, index) => {
    const germanText = (word.german || word.french || '').trim()
    const isNoun = isGermanNoun(germanText)

    // Lần 1: Nhận diện & Mạo từ (der/die/das)
    const stage1Type: ExerciseType = isNoun
      ? 'article_quiz'
      : word.repetition === 0
        ? 'new_intro'
        : 'choice'
    roundTasks[0].push({
      word,
      exerciseType: stage1Type,
      round: 1,
      totalRounds
    })

    // Lần 2: Phản xạ Dịch ngược Trắc nghiệm (Việt ➜ Đức) & Nghe hiểu
    const stage2Type: ExerciseType = index % 2 === 0 ? 'reverse_choice' : 'listening_choice'
    roundTasks[1].push({
      word,
      exerciseType: stage2Type,
      round: 2,
      totalRounds
    })

    // Lần 3: Luyện Phát âm Giọng nói ('speaking' 🎙️) & Xếp mảnh chữ ('scramble' 🧩)
    const stage3Type: ExerciseType = index % 2 === 0 ? 'speaking' : 'scramble'
    roundTasks[2].push({
      word,
      exerciseType: stage3Type,
      round: 3,
      totalRounds
    })

    // Lần 4: Chủ động Gõ Dịch ngược Việt ➜ Đức ('reverse'), Điền ngữ cảnh ('cloze'), hoặc Nghe viết ('dictee')
    let stage4Type: ExerciseType = 'reverse' // Ưu tiên Dịch ngược Việt -> Đức
    if (index % 3 === 1 && word.example && word.example.length > 5) {
      stage4Type = 'cloze'
    } else if (index % 3 === 2) {
      stage4Type = 'dictee'
    }

    roundTasks[3].push({
      word,
      exerciseType: stage4Type,
      round: 4,
      totalRounds
    })
  })

  // Shuffle each round independently using Fisher-Yates
  const shuffle = <T>(arr: T[]): T[] => {
    const res = [...arr]
    for (let i = res.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[res[i], res[j]] = [res[j], res[i]]
    }
    return res
  }

  const flattenedQueue: StudyTask[] = []
  for (let r = 0; r < totalRounds; r++) {
    const shuffledRound = shuffle(roundTasks[r])

    // Đảm bảo từ cuối của vòng trước không trùng với từ đầu của vòng tiếp theo
    if (
      flattenedQueue.length > 0 &&
      shuffledRound.length > 1 &&
      flattenedQueue[flattenedQueue.length - 1].word.id === shuffledRound[0].word.id
    ) {
      ;[shuffledRound[0], shuffledRound[1]] = [shuffledRound[1], shuffledRound[0]]
    }

    flattenedQueue.push(...shuffledRound)
  }

  return flattenedQueue
}
