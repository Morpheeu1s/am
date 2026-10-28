import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Volume2,
  Sparkles,
  ArrowRight,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Eye,
  FileQuestion,
  Trophy,
  Headphones,
  Languages,
  Play,
  PlusCircle,
  Check,
  CheckCheck,
  Puzzle
} from 'lucide-react'
import type { Word, ReviewQuality, StudyTask } from '@/types'
import { updateSRS, getMasteryInfo } from '@/lib/srs'
import { updateWord } from '@/lib/db'
import { speakGerman, unlockAudio } from '@/lib/speech'
import { playFeedback } from '@/lib/audio'
import { evaluateAnswer, maskSentence } from '@/lib/fuzzy'
import {
  buildInterleavedStudyTasks,
  getGermanArticleAndNoun,
  generateScrambleTiles
} from '@/lib/studyQueue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import confetti from 'canvas-confetti'

interface StudyViewProps {
  initialWords: Word[]
  allWords: Word[]
  onSessionComplete?: () => void
  onLoadMoreNewWords?: () => Promise<Word[]> | void
}

const GERMAN_UMLAUTS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']

export function StudyView({
  initialWords,
  allWords,
  onSessionComplete,
  onLoadMoreNewWords
}: StudyViewProps) {
  // Generate 4-repetition interleaved tasks queue
  const [tasks, setTasks] = useState<StudyTask[]>(() => buildInterleavedStudyTasks(initialWords))
  const [prevInitialWords, setPrevInitialWords] = useState(initialWords)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedTasksCount, setCompletedTasksCount] = useState(0)

  // Track mistakes per word ID in this session to accurately score SM-2 quality at the end
  const [wordMistakesMap, setWordMistakesMap] = useState<Record<number, number>>({})

  // Session state: 'overview' | 'active'
  const [sessionState, setSessionState] = useState<'overview' | 'active'>('overview')
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Answer interaction states
  const [userInput, setUserInput] = useState('')
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [fuzzyStatus, setFuzzyStatus] = useState<'idle' | 'correct' | 'typo' | 'incorrect'>('idle')
  const [fuzzyMessage, setFuzzyMessage] = useState('')

  // Selected option for multiple choice / listening choice / reverse choice
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)

  // Selected article for Article Quiz ('der' | 'die' | 'das')
  const [selectedArticle, setSelectedArticle] = useState<'der' | 'die' | 'das' | null>(null)

  // Scramble tiles state (Duolingo tile puzzle)
  const [selectedTileIds, setSelectedTileIds] = useState<number[]>([])

  const inputRef = useRef<HTMLInputElement>(null)

  // Current active task and word
  const currentTask = tasks[currentIndex]
  const currentWord = currentTask?.word
  const currentGerman = currentWord ? (currentWord.german || currentWord.french || '').trim() : ''
  const exerciseType = currentTask?.exerciseType || 'choice'

  // Reset/sync when initialWords prop changes externally
  if (initialWords !== prevInitialWords) {
    setPrevInitialWords(initialWords)
    const newTasks = buildInterleavedStudyTasks(initialWords)
    setTasks(newTasks)
    setCurrentIndex(0)
    setCompletedTasksCount(0)
    setWordMistakesMap({})
  }

  // Pure derived scramble tiles without setState in useEffect
  const allScrambleTiles = useMemo<{ id: number; text: string }[]>(() => {
    if (exerciseType !== 'scramble' || !currentGerman) return []
    const { shuffledTiles } = generateScrambleTiles(currentGerman)
    return shuffledTiles.map((text, idx) => ({ id: idx, text }))
  }, [exerciseType, currentGerman])

  const selectedTiles = useMemo(
    () => selectedTileIds.map((id) => allScrambleTiles.find((t) => t.id === id)!).filter(Boolean),
    [selectedTileIds, allScrambleTiles]
  )

  const availableTiles = useMemo(
    () => allScrambleTiles.filter((t) => !selectedTileIds.includes(t.id)),
    [selectedTileIds, allScrambleTiles]
  )

  // Generate 4 Vietnamese options for 'choice' and 'listening_choice'
  const choiceOptions = useMemo<string[]>(() => {
    if (!currentWord || (exerciseType !== 'choice' && exerciseType !== 'listening_choice')) {
      return []
    }
    const correctAnswer = currentWord.vietnamese
    const currentG = currentWord.german || currentWord.french || ''

    const baseSeed = ((currentWord.id ?? 1) * 17 + currentIndex * 31) & 0x7fffffff
    const candidates = allWords.filter(
      (w) => (w.german || w.french) !== currentG && w.vietnamese !== correctAnswer
    )
    if (candidates.length === 0) return [correctAnswer]

    const distractors: string[] = []
    for (let i = 0; i < candidates.length && distractors.length < 3; i++) {
      const idx = (baseSeed + i * 47) % candidates.length
      const cand = candidates[idx]
      if (cand && !distractors.includes(cand.vietnamese)) {
        distractors.push(cand.vietnamese)
      }
    }

    const options = [correctAnswer, ...distractors]
    return [...options].sort((a, b) => {
      const hashA = (a.charCodeAt(0) * 31 + baseSeed) % 100
      const hashB = (b.charCodeAt(0) * 31 + baseSeed) % 100
      return hashA - hashB
    })
  }, [currentWord, exerciseType, allWords, currentIndex])

  // Generate 4 German options for 'reverse_choice' (Nhìn tiếng Việt ➜ Chọn từ tiếng Đức)
  const reverseChoiceOptions = useMemo<string[]>(() => {
    if (!currentWord || exerciseType !== 'reverse_choice') return []
    const correctAnswer = (currentWord.german || currentWord.french || '').trim()

    const baseSeed = ((currentWord.id ?? 1) * 23 + currentIndex * 41) & 0x7fffffff
    const candidates = allWords.filter(
      (w) => (w.german || w.french || '').trim() !== correctAnswer
    )
    if (candidates.length === 0) return [correctAnswer]

    const distractors: string[] = []
    for (let i = 0; i < candidates.length && distractors.length < 3; i++) {
      const idx = (baseSeed + i * 53) % candidates.length
      const candG = (candidates[idx]?.german || candidates[idx]?.french || '').trim()
      if (candG && !distractors.includes(candG)) {
        distractors.push(candG)
      }
    }

    const options = [correctAnswer, ...distractors]
    return [...options].sort((a, b) => {
      const hashA = (a.charCodeAt(0) * 37 + baseSeed) % 100
      const hashB = (b.charCodeAt(0) * 37 + baseSeed) % 100
      return hashA - hashB
    })
  }, [currentWord, exerciseType, allWords, currentIndex])

  // Auto-pronounce on card load
  useEffect(() => {
    if (sessionState === 'active' && currentGerman) {
      if (
        exerciseType === 'new_intro' ||
        exerciseType === 'dictee' ||
        exerciseType === 'choice' ||
        exerciseType === 'listening_choice'
      ) {
        const timer = setTimeout(() => {
          speakGerman(currentGerman, 1.0)
        }, 200)
        return () => clearTimeout(timer)
      }
    }
  }, [sessionState, currentIndex, currentGerman, exerciseType])

  // Focus input automatically for typing modes
  useEffect(() => {
    if (
      sessionState === 'active' &&
      !isAnswerRevealed &&
      (exerciseType === 'dictee' || exerciseType === 'reverse' || exerciseType === 'cloze')
    ) {
      const t = setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
      return () => clearTimeout(t)
    }
  }, [sessionState, currentIndex, isAnswerRevealed, exerciseType])

  const handlePronounce = (e?: React.MouseEvent, text?: string) => {
    e?.stopPropagation()
    unlockAudio()
    if (currentGerman) {
      playFeedback('click')
      speakGerman(text || currentGerman, 1.0)
    }
  }

  const resetCardState = () => {
    setUserInput('')
    setSelectedChoice(null)
    setSelectedArticle(null)
    setIsAnswerRevealed(false)
    setIsAnswerSubmitted(false)
    setFuzzyStatus('idle')
    setFuzzyMessage('')
    setSelectedTileIds([])
  }

  // Insert German Umlaut character into typing input
  const handleInsertUmlaut = (char: string) => {
    unlockAudio()
    playFeedback('click')
    const input = inputRef.current
    if (!input) {
      setUserInput((prev) => prev + char)
      return
    }
    const start = input.selectionStart ?? userInput.length
    const end = input.selectionEnd ?? userInput.length
    const nextVal = userInput.substring(0, start) + char + userInput.substring(end)
    setUserInput(nextVal)

    setTimeout(() => {
      input.focus()
      input.setSelectionRange(start + char.length, start + char.length)
    }, 10)
  }

  // 1. Handle Article Quiz Click (der / die / das)
  const handleSelectArticle = (article: 'der' | 'die' | 'das') => {
    if (!currentWord || isAnswerRevealed || isAnswerSubmitted) return
    unlockAudio()
    setSelectedArticle(article)

    const articleInfo = getGermanArticleAndNoun(currentGerman)
    const isCorrect = articleInfo?.article === article

    if (isCorrect) {
      playFeedback('success')
      setFuzzyStatus('correct')
      setFuzzyMessage(`Chính xác! ${article} ${articleInfo?.noun}`)
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
    } else {
      playFeedback('error')
      setFuzzyStatus('incorrect')
      setFuzzyMessage(`Sai rồi! Mạo từ đúng là '${articleInfo?.article}'.`)
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
      if (currentWord.id) {
        setWordMistakesMap((prev) => ({
          ...prev,
          [currentWord.id!]: (prev[currentWord.id!] || 0) + 1
        }))
      }
    }
  }

  // 2. Handle Multiple Choice / Listening Choice Selection (Vietnamese options)
  const handleSelectChoice = (option: string) => {
    if (!currentWord || isAnswerRevealed || isAnswerSubmitted) return
    unlockAudio()
    setSelectedChoice(option)

    const isCorrect = option === currentWord.vietnamese
    if (isCorrect) {
      playFeedback('success')
      setFuzzyStatus('correct')
      setFuzzyMessage('Chính xác hoàn toàn! Ausgezeichnet!')
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
    } else {
      playFeedback('error')
      setFuzzyStatus('incorrect')
      setFuzzyMessage(`Đáp án đúng là: ${currentWord.vietnamese}`)
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
      if (currentWord.id) {
        setWordMistakesMap((prev) => ({
          ...prev,
          [currentWord.id!]: (prev[currentWord.id!] || 0) + 1
        }))
      }
    }
  }

  // 2B. Handle Reverse Choice Selection (Nhìn Việt ➜ Chọn từ Đức)
  const handleSelectReverseChoice = (germanOption: string) => {
    if (!currentWord || isAnswerRevealed || isAnswerSubmitted) return
    unlockAudio()
    setSelectedChoice(germanOption)

    const isCorrect = germanOption === currentGerman
    if (isCorrect) {
      playFeedback('success')
      setFuzzyStatus('correct')
      setFuzzyMessage('Dịch ngược chính xác! Sehr gut!')
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
    } else {
      playFeedback('error')
      setFuzzyStatus('incorrect')
      setFuzzyMessage(`Từ tiếng Đức đúng là: ${currentGerman}`)
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
      if (currentWord.id) {
        setWordMistakesMap((prev) => ({
          ...prev,
          [currentWord.id!]: (prev[currentWord.id!] || 0) + 1
        }))
      }
    }
  }

  // 3. Handle Scramble Tile Selection (Duolingo style)
  const handlePickTile = (tile: { id: number; text: string }) => {
    if (isAnswerRevealed) return
    playFeedback('click')
    setSelectedTileIds((prev) => [...prev, tile.id])
  }

  const handleUnpickTile = (tile: { id: number; text: string }) => {
    if (isAnswerRevealed) return
    playFeedback('pop')
    setSelectedTileIds((prev) => prev.filter((id) => id !== tile.id))
  }

  const handleCheckScramble = () => {
    if (isAnswerRevealed || selectedTiles.length === 0) return
    unlockAudio()

    const formedWithSpace = selectedTiles.map((t) => t.text).join(' ').trim()
    const formedDirect = selectedTiles.map((t) => t.text).join('').trim()
    const targetClean = currentGerman.toLowerCase()

    const isMatch =
      formedWithSpace.toLowerCase() === targetClean ||
      formedDirect.toLowerCase() === targetClean.replace(/\s+/g, '') ||
      formedDirect.toLowerCase() === targetClean

    if (isMatch) {
      playFeedback('success')
      setFuzzyStatus('correct')
      setFuzzyMessage('Ghép từ hoàn toàn chính xác!')
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
    } else {
      playFeedback('error')
      setFuzzyStatus('incorrect')
      setFuzzyMessage(`Chưa đúng! Từ chuẩn là: ${currentGerman}`)
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
      if (currentWord?.id) {
        setWordMistakesMap((prev) => ({
          ...prev,
          [currentWord.id!]: (prev[currentWord.id!] || 0) + 1
        }))
      }
    }
  }

  // 4. Handle Typing Submission (Reverse Việt ➜ Đức / Dictée / Cloze)
  const handleSubmitTyping = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!currentWord || isAnswerSubmitted || isAnswerRevealed) return

    unlockAudio()
    const evaluation = evaluateAnswer(userInput, currentGerman)

    if (evaluation.status === 'correct') {
      playFeedback('success')
      setFuzzyStatus('correct')
      setFuzzyMessage('Chính xác hoàn toàn! Sehr gut!')
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
    } else if (evaluation.status === 'typo') {
      playFeedback('typo')
      setFuzzyStatus('typo')
      setFuzzyMessage(evaluation.message || 'Gần đúng rồi, chú ý ký tự Umlaut hoặc mạo từ!')
      inputRef.current?.focus()
    } else {
      playFeedback('error')
      setFuzzyStatus('incorrect')
      setFuzzyMessage('Chưa chính xác!')
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
      if (currentWord.id) {
        setWordMistakesMap((prev) => ({
          ...prev,
          [currentWord.id!]: (prev[currentWord.id!] || 0) + 1
        }))
      }
    }
  }

  // Direct reveal
  const handleReveal = () => {
    if (!currentWord) return
    unlockAudio()
    playFeedback('pop')
    setIsAnswerRevealed(true)
    setIsAnswerSubmitted(true)
    setFuzzyStatus('incorrect')
    setFuzzyMessage('Đã mở đáp án')
    speakGerman(currentGerman, 1.0)
    if (currentWord.id) {
      setWordMistakesMap((prev) => ({
        ...prev,
        [currentWord.id!]: (prev[currentWord.id!] || 0) + 1
      }))
    }
  }

  // Advance to next task in interleaved queue & save SRS if word reached end
  const handleAdvanceTask = async (customQuality?: ReviewQuality) => {
    if (!currentWord || !currentTask) return
    unlockAudio()
    playFeedback('click')

    const isSuccess = fuzzyStatus === 'correct'
    const wordId = currentWord.id || 0
    const mistakesSoFar = (wordMistakesMap[wordId] || 0) + (isSuccess ? 0 : 1)

    // Check if this is the final round for this word
    const remainingTasksForThisWord = tasks
      .slice(currentIndex + 1)
      .filter((t) => t.word.id === currentWord.id).length

    if (remainingTasksForThisWord === 0 && currentWord.id) {
      // All 4 rounds completed for this word -> compute and save SM-2 update
      const quality: ReviewQuality =
        customQuality ?? (mistakesSoFar === 0 ? 5 : mistakesSoFar === 1 ? 3 : 2)
      const srsUpdate = updateSRS(currentWord, quality >= 3, quality)

      await updateWord(currentWord.id, {
        repetition: srsUpdate.repetition,
        interval: srsUpdate.interval,
        easeFactor: srsUpdate.easeFactor,
        dueDate: srsUpdate.dueDate,
        mistakes: srsUpdate.mistakes
      })
    }

    resetCardState()

    // If task was failed, push an extra reinforcement task for this word to the back!
    if (!isSuccess) {
      const updatedTasks = [...tasks]
      const reinforcementTask: StudyTask = {
        word: currentWord,
        exerciseType: currentTask.exerciseType,
        round: currentTask.round,
        totalRounds: currentTask.totalRounds
      }
      updatedTasks.push(reinforcementTask)
      setTasks(updatedTasks)
      setCurrentIndex((prev) => prev + 1)
    } else {
      setCompletedTasksCount((prev) => prev + 1)
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)

      if (nextIndex >= tasks.length) {
        triggerConfetti()
        onSessionComplete?.()
      }
    }
  }

  const triggerConfetti = () => {
    playFeedback('success')
    confetti({
      particleCount: 90,
      spread: 70,
      origin: { y: 0.6 }
    })
    setTimeout(() => {
      confetti({
        particleCount: 50,
        angle: 60,
        spread: 55,
        origin: { x: 0 }
      })
      confetti({
        particleCount: 50,
        angle: 120,
        spread: 55,
        origin: { x: 1 }
      })
    }, 200)
  }

  const handleLoadMore = async () => {
    if (!onLoadMoreNewWords) return
    setIsLoadingMore(true)
    unlockAudio()
    playFeedback('click')
    try {
      const res = await onLoadMoreNewWords()
      const newWords = Array.isArray(res) ? res : []
      if (newWords.length > 0) {
        const newTasks = buildInterleavedStudyTasks(newWords)
        setTasks(newTasks)
        setCurrentIndex(0)
        setCompletedTasksCount(0)
        setWordMistakesMap({})
        resetCardState()
        setSessionState('active')
      } else {
        setSessionState('active')
      }
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoadingMore(false)
    }
  }

  // 1. Pre-session Overview screen
  if (sessionState === 'overview') {
    const dueCount = initialWords.filter((w) => (w.repetition ?? 0) > 0).length
    const newCount = initialWords.filter((w) => (w.repetition ?? 0) === 0).length
    const totalInteractions = initialWords.length * 4

    return (
      <div className="w-full max-w-xl md:max-w-2xl mx-auto space-y-4 sm:space-y-5 animate-in fade-in duration-300 pb-16">
        {/* Google Labs Hero Card */}
        <div
          style={{
            borderRadius: 28,
            backgroundColor: '#1e1f20',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)'
          }}
          className="relative overflow-hidden p-4 sm:p-6 md:p-8"
        >
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-[#1a73e8]/25 via-[#7c3aed]/20 to-[#d946ef]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between pb-3 sm:pb-4 gap-2 flex-wrap">
              <span
                style={{ borderRadius: 9999 }}
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8c7fa] bg-[#004a77]/40 px-3 py-0.5 sm:px-3.5 sm:py-1 border border-[#004a77]"
              >
                Goethe A1 · Đa tương tác
              </span>
              <span
                style={{ borderRadius: 9999 }}
                className="text-[11px] sm:text-xs text-[#c4eed0] font-mono px-2.5 py-0.5 sm:px-3 sm:py-1 bg-[#0f5223]/50 border border-[#34a853]/60 font-semibold"
              >
                Lặp 4 lần / từ · {totalInteractions} thử thách
              </span>
            </div>

            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight mt-1 mb-2 font-outfit">
              Học từ vựng đa chiều 4 vòng lặp !
            </h2>
            <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed mb-5 sm:mb-6">
              Mỗi từ vựng được <strong>lặp lại 4 lần xen kẽ ngẫu nhiên</strong> với các dạng tương tác khác nhau: Chọn mạo từ (der/die/das), Phản xạ Việt ➜ Đức, Nghe hiểu, Xếp mảnh chữ và Gõ dịch ngược Việt ➜ Đức.
            </p>

            {/* 4 Interactive Modalities Showcase */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5 sm:mb-6">
              <div
                style={{ borderRadius: 18 }}
                className="p-3 bg-[#282a2c] border border-[#3c4043] text-center space-y-1"
              >
                <div className="text-[#a8c7fa] font-bold text-xs flex items-center justify-center gap-1">
                  <Check className="h-3.5 w-3.5" />
                  Vòng 1
                </div>
                <div className="text-[11px] text-[#e3e3e3] font-semibold">Quiz Mạo từ</div>
                <div className="text-[10px] text-[#8e918f]">der / die / das</div>
              </div>

              <div
                style={{ borderRadius: 18 }}
                className="p-3 bg-[#282a2c] border border-[#3c4043] text-center space-y-1"
              >
                <div className="text-[#c084fc] font-bold text-xs flex items-center justify-center gap-1">
                  <Headphones className="h-3.5 w-3.5" />
                  Vòng 2
                </div>
                <div className="text-[11px] text-[#e3e3e3] font-semibold">Nghe & Dịch ngược</div>
                <div className="text-[10px] text-[#8e918f]">Chọn từ Việt ➜ Đức</div>
              </div>

              <div
                style={{ borderRadius: 18 }}
                className="p-3 bg-[#282a2c] border border-[#3c4043] text-center space-y-1"
              >
                <div className="text-[#fbbc04] font-bold text-xs flex items-center justify-center gap-1">
                  <Puzzle className="h-3.5 w-3.5" />
                  Vòng 3
                </div>
                <div className="text-[11px] text-[#e3e3e3] font-semibold">Xếp mảnh chữ</div>
                <div className="text-[10px] text-[#8e918f]">Ghép từ Duolingo</div>
              </div>

              <div
                style={{ borderRadius: 18 }}
                className="p-3 bg-[#282a2c] border border-[#3c4043] text-center space-y-1"
              >
                <div className="text-[#34a853] font-bold text-xs flex items-center justify-center gap-1">
                  <CheckCheck className="h-3.5 w-3.5" />
                  Vòng 4
                </div>
                <div className="text-[11px] text-[#e3e3e3] font-semibold">Gõ Việt ➜ Đức</div>
                <div className="text-[10px] text-[#8e918f]">Dịch ngược & Điền từ</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 mb-5 sm:mb-6">
              <div
                style={{ borderRadius: 20 }}
                className="border border-[#3c4043] bg-[#282a2c] p-3.5 sm:p-5"
              >
                <div className="text-2xl sm:text-3xl font-extrabold text-[#a8c7fa] font-outfit">{newCount}</div>
                <div className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium mt-1">Từ mới trong phiên</div>
              </div>
              <div
                style={{ borderRadius: 20 }}
                className="border border-[#3c4043] bg-[#282a2c] p-3.5 sm:p-5"
              >
                <div className="text-2xl sm:text-3xl font-extrabold text-[#ffe082] font-outfit">{dueCount}</div>
                <div className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium mt-1">Từ cũ cần ôn</div>
              </div>
            </div>

            <Button
              variant="labs"
              size="lg"
              onClick={() => {
                unlockAudio()
                playFeedback('success')
                setSessionState('active')
              }}
              style={{ borderRadius: 9999 }}
              className="w-full h-12 sm:h-14 text-sm sm:text-base font-bold shadow-lg shadow-indigo-500/25 group cursor-pointer"
            >
              <Play className="h-4 w-4 sm:h-5 sm:w-5 mr-2 fill-current transition-transform group-hover:scale-110" />
              Bắt đầu học ngay ({totalInteractions} lượt tương tác)
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // 2. All cards completed Celebration view
  if (!currentWord || currentIndex >= tasks.length) {
    return (
      <div className="flex flex-col items-center justify-center py-8 sm:py-12 px-3 text-center animate-in fade-in zoom-in-95 duration-300 w-full max-w-xl md:max-w-2xl mx-auto pb-16">
        <div className="relative mb-5 sm:mb-6">
          <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full bg-gradient-to-tr from-[#0f5223]/30 via-[#004a77]/30 to-[#381e72]/30 flex items-center justify-center border border-[#34a853]/40 shadow-xl shadow-green-500/10">
            <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-[#c4eed0]" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-5 w-5 sm:h-6 sm:w-6 text-[#fbbc04] animate-bounce" />
        </div>

        <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 font-outfit">
          Wunderbar ! Hoàn thành phiên học!
        </h2>
        <p className="text-xs sm:text-sm text-[#c4c7c5] max-w-sm mb-5 sm:mb-6 leading-relaxed">
          Tất cả {initialWords.length} từ vựng đã hoàn thành <strong>4 lượt lặp lại đa phương thức</strong> và được ghi nhận vào thuật toán SM-2.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full max-w-sm mb-6 sm:mb-8">
          <div
            style={{ borderRadius: 20 }}
            className="border border-[#3c4043] bg-[#1e1f20] p-3.5 sm:p-5"
          >
            <div className="text-2xl sm:text-3xl font-extrabold text-white font-outfit">{initialWords.length}</div>
            <div className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium mt-1">Từ đã khắc sâu</div>
          </div>
          <div
            style={{ borderRadius: 20 }}
            className="border border-[#3c4043] bg-[#1e1f20] p-3.5 sm:p-5"
          >
            <div className="text-2xl sm:text-3xl font-extrabold text-[#c4eed0] font-outfit">{completedTasksCount}</div>
            <div className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium mt-1">Lượt tương tác đạt</div>
          </div>
        </div>

        <div className="space-y-2.5 sm:space-y-3 w-full max-w-sm">
          {onLoadMoreNewWords && (
            <Button
              variant="primary"
              size="lg"
              disabled={isLoadingMore}
              style={{ borderRadius: 9999 }}
              className="w-full font-bold shadow-md shadow-blue-500/20 cursor-pointer h-12 sm:h-13 text-xs sm:text-sm"
              onClick={handleLoadMore}
            >
              <PlusCircle className="h-4 w-4 mr-2" />
              {isLoadingMore ? 'Đang tải...' : 'Học thêm 10 từ mới từ kho Goethe'}
            </Button>
          )}

          <Button
            variant="outline"
            size="md"
            style={{ borderRadius: 9999 }}
            className="w-full text-xs text-[#c4c7c5] hover:text-white cursor-pointer h-11"
            onClick={() => {
              unlockAudio()
              if (initialWords.length > 0) {
                const newTasks = buildInterleavedStudyTasks(initialWords)
                setTasks(newTasks)
                setCurrentIndex(0)
                setCompletedTasksCount(0)
                setWordMistakesMap({})
                resetCardState()
                setSessionState('active')
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Luyện lại phiên này
          </Button>
        </div>
      </div>
    )
  }

  // 3. Active Interactive Card Session
  const cloze = maskSentence(currentWord.example || '', currentGerman)
  const mastery = getMasteryInfo(currentWord.repetition ?? 0)
  const articleInfo = getGermanArticleAndNoun(currentGerman)

  return (
    <div className="flex flex-col w-full max-w-xl md:max-w-2xl mx-auto space-y-4 sm:space-y-5 pb-16 animate-in fade-in duration-200">
      {/* Session Progress Header */}
      <div className="space-y-1.5 px-1 sm:px-2">
        <div className="flex items-center justify-between text-xs text-[#c4c7c5] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#a8c7fa] animate-pulse" />
            <span>Thử thách {currentIndex + 1} / {tasks.length}</span>
            <span className="text-[#a8c7fa] font-semibold bg-[#004a77]/40 px-2.5 py-0.5 rounded-full border border-[#004a77]">
              Lần lặp {currentTask.round}/{currentTask.totalRounds} của từ này
            </span>
          </div>
          <span className="font-mono text-[#a8c7fa] font-semibold text-xs sm:text-sm">
            {Math.round((completedTasksCount / Math.max(1, tasks.length)) * 100)}%
          </span>
        </div>
        <Progress value={completedTasksCount} max={Math.max(1, tasks.length)} />
      </div>

      {/* Main Flashcard Card (Google Labs Material 3 Surface) */}
      <div
        style={{
          borderRadius: 28,
          backgroundColor: '#1e1f20',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)'
        }}
        className="relative p-4 sm:p-6 md:p-8 transition-all duration-300"
      >
        {/* Top Info Bar */}
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-1.5 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span
              style={{ borderRadius: 9999 }}
              className={`text-[11px] sm:text-xs font-semibold px-2.5 sm:px-3.5 py-0.5 sm:py-1 border ${mastery.badgeClass}`}
            >
              {mastery.shortLabel} · {mastery.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              style={{ borderRadius: 9999 }}
              className="text-[11px] sm:text-xs px-2.5 sm:px-3.5 py-0.5 sm:py-1 bg-[#282a2c] text-[#c4c7c5] font-medium border border-[#444746]/60 flex items-center gap-1"
            >
              {exerciseType === 'article_quiz' && '🔵 Quiz Mạo từ (der/die/das)'}
              {exerciseType === 'reverse_choice' && '🇻🇳➜🇩🇪 Chọn từ tiếng Đức'}
              {exerciseType === 'listening_choice' && '🎧 Nghe âm thanh ➜ Chọn nghĩa'}
              {exerciseType === 'scramble' && '🧩 Xếp mảnh chữ tiếng Đức'}
              {exerciseType === 'choice' && '🇩🇪➜🇻🇳 Chọn nghĩa tiếng Việt'}
              {exerciseType === 'reverse' && '✍️ Dịch ngược Việt ➜ Gõ tiếng Đức'}
              {exerciseType === 'dictee' && '🎧 Nghe ➜ Chép chính tả'}
              {exerciseType === 'cloze' && '📝 Điền từ vào câu'}
              {exerciseType === 'new_intro' && '✨ Khám phá từ mới'}
            </span>
          </div>
        </div>

        {/* Content Area Based on Exercise Type */}
        <div className="py-1 sm:py-2 text-center">
          {/* 0. NEW WORD INTRO (Khám phá từ mới lần đầu) */}
          {exerciseType === 'new_intro' && (
            <div className="space-y-4 sm:space-y-5 py-1 text-center animate-in fade-in duration-200">
              <div className="space-y-1">
                <span className="text-[11px] sm:text-xs font-semibold text-[#a8c7fa] uppercase tracking-wider">
                  Làm quen từ mới
                </span>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <h2 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight font-outfit">
                    {currentGerman}
                  </h2>
                  <button
                    type="button"
                    onClick={(e) => handlePronounce(e)}
                    style={{ borderRadius: 9999 }}
                    className="h-10 w-10 sm:h-11 sm:w-11 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/40 border border-[#a8c7fa]/30 transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
                {currentWord.ipa && (
                  <div className="text-xs sm:text-sm font-mono text-[#a8c7fa]/90">{currentWord.ipa}</div>
                )}
              </div>

              <div
                style={{ borderRadius: 20 }}
                className="bg-[#282a2c] p-3.5 sm:p-5 border border-[#3c4043]"
              >
                <div className="text-base sm:text-lg md:text-xl font-bold text-[#e3e3e3]">
                  {currentWord.vietnamese}
                </div>
              </div>

              {currentWord.example && (
                <div
                  style={{ borderRadius: 20 }}
                  className="bg-[#282a2c]/70 p-3 sm:p-4 border border-[#3c4043]/70 text-xs sm:text-sm space-y-1 text-left"
                >
                  <div className="text-[#e3e3e3] font-medium flex items-center justify-between gap-2">
                    <span className="leading-snug">{currentWord.example}</span>
                    <button
                      onClick={(e) => handlePronounce(e, currentWord.example)}
                      className="text-[#a8c7fa] hover:text-[#c2e7ff] p-1 cursor-pointer shrink-0"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                  {currentWord.exampleVi && (
                    <div className="text-[#c4c7c5] italic leading-snug">{currentWord.exampleVi}</div>
                  )}
                </div>
              )}

              <Button
                variant="primary"
                size="lg"
                onClick={() => {
                  playFeedback('success')
                  setFuzzyStatus('correct')
                  handleAdvanceTask()
                }}
                style={{ borderRadius: 9999 }}
                className="w-full font-bold h-12 sm:h-13 text-xs sm:text-sm shadow-md shadow-blue-500/20 cursor-pointer"
              >
                <span>Đã nhớ mặt chữ · Sang thử thách tiếp theo</span>
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          )}

          {/* A. ARTICLE QUIZ (der / die / das) */}
          {exerciseType === 'article_quiz' && articleInfo && (
            <div className="space-y-4 sm:space-y-5 py-1">
              <div className="space-y-1">
                <span className="text-xs text-[#a8c7fa] font-medium">Chọn mạo từ đúng cho danh từ này:</span>
                <div className="flex items-center justify-center gap-2">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight font-outfit">
                    {isAnswerRevealed ? (
                      <span className="text-[#a8c7fa]">{currentGerman}</span>
                    ) : (
                      <span>
                        <span className="text-[#8e918f] underline underline-offset-4 decoration-dashed decoration-[#a8c7fa]">
                          [ ... ]
                        </span>{' '}
                        {articleInfo.noun}
                      </span>
                    )}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => handlePronounce(e)}
                    style={{ borderRadius: 9999 }}
                    className="h-10 w-10 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/40 border border-[#a8c7fa]/30 transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
                <div className="text-sm text-[#e3e3e3] font-medium mt-1">
                  Nghĩa: <span className="text-[#c4eed0] font-semibold">{currentWord.vietnamese}</span>
                </div>
              </div>

              {/* 3 Large Tactile Article Buttons */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-3 pt-2">
                {(['der', 'die', 'das'] as const).map((art) => {
                  const isSelected = selectedArticle === art
                  const isCorrect = articleInfo.article === art

                  let btnColor = 'bg-[#282a2c] border-[#444746] text-white hover:border-[#a8c7fa]'
                  if (art === 'der') btnColor = 'bg-[#004a77]/30 border-[#004a77] text-[#c2e7ff] hover:bg-[#004a77]/50'
                  if (art === 'die') btnColor = 'bg-[#410002]/30 border-[#93000a]/60 text-[#ffdad6] hover:bg-[#410002]/50'
                  if (art === 'das') btnColor = 'bg-[#0f5223]/30 border-[#34a853]/60 text-[#c4eed0] hover:bg-[#0f5223]/50'

                  if (isAnswerRevealed) {
                    if (isCorrect) {
                      btnColor = 'bg-[#0f5223] border-[#34a853] text-[#c4eed0] font-bold shadow-lg scale-105'
                    } else if (isSelected) {
                      btnColor = 'bg-[#8c1d18]/40 border-[#f2b8b5] text-[#f2b8b5] opacity-60'
                    } else {
                      btnColor = 'opacity-30 border-[#3c4043]'
                    }
                  }

                  return (
                    <button
                      key={art}
                      disabled={isAnswerRevealed}
                      onClick={() => handleSelectArticle(art)}
                      style={{ borderRadius: 20 }}
                      className={`h-14 sm:h-16 flex flex-col items-center justify-center border-2 transition-all active:scale-95 cursor-pointer font-outfit ${btnColor}`}
                    >
                      <span className="text-lg sm:text-xl font-extrabold">{art}</span>
                      <span className="text-[10px] opacity-75 font-normal">
                        {art === 'der' ? 'Giống đực' : art === 'die' ? 'Giống cái' : 'Giống trung'}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* B. REVERSE CHOICE (Dịch ngược Trắc nghiệm: Nhìn nghĩa Việt ➜ Chọn từ tiếng Đức) */}
          {exerciseType === 'reverse_choice' && (
            <div className="space-y-4 sm:space-y-5 py-1">
              <div className="space-y-1">
                <span className="text-xs text-[#c084fc] font-medium flex items-center justify-center gap-1">
                  <Languages className="h-3.5 w-3.5" />
                  Chọn từ tiếng Đức ứng với nghĩa tiếng Việt sau:
                </span>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight font-outfit mt-1">
                  &ldquo;{currentWord.vietnamese}&rdquo;
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pt-1 text-left">
                {reverseChoiceOptions.map((opt, i) => {
                  const isSelected = selectedChoice === opt
                  const isCorrectAnswer = opt === currentGerman

                  let btnStyle =
                    'bg-[#282a2c]/80 border-[#444746] text-[#e3e3e3] hover:bg-[#282a2c] hover:border-[#a8c7fa]'
                  if (isAnswerRevealed) {
                    if (isCorrectAnswer) {
                      btnStyle =
                        'bg-[#0f5223]/40 border-[#34a853] text-[#c4eed0] font-semibold shadow-md shadow-green-500/10'
                    } else if (isSelected) {
                      btnStyle = 'bg-[#8c1d18]/30 border-[#f2b8b5] text-[#f2b8b5]'
                    } else {
                      btnStyle = 'bg-[#282a2c]/30 border-[#3c4043]/50 text-[#8e918f] opacity-50'
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={isAnswerRevealed}
                      onClick={() => handleSelectReverseChoice(opt)}
                      style={{ borderRadius: 18 }}
                      className={`flex items-center justify-between p-3.5 sm:p-4 border text-sm sm:text-base font-bold font-outfit transition-all active:scale-[0.98] cursor-pointer ${btnStyle}`}
                    >
                      <span className="leading-snug">{opt}</span>
                      {isAnswerRevealed && isCorrectAnswer && (
                        <CheckCircle2 className="h-4 w-4 text-[#34a853] shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* C. LISTENING CHOICE (Nghe phản xạ tai không nhìn chữ) */}
          {exerciseType === 'listening_choice' && (
            <div className="space-y-4 sm:space-y-5 py-2">
              <div className="flex flex-col items-center space-y-3">
                <button
                  type="button"
                  onClick={(e) => handlePronounce(e)}
                  style={{
                    width: 80,
                    height: 80,
                    borderRadius: 9999,
                    boxShadow: '0 8px 24px -2px rgba(26, 115, 232, 0.35)'
                  }}
                  className="flex items-center justify-center border-2 border-[#a8c7fa]/60 bg-[#004a77]/40 hover:bg-[#004a77]/60 text-[#a8c7fa] active:scale-95 transition-all cursor-pointer"
                  title="Chạm để nghe lại"
                >
                  <Volume2 className="h-9 w-9 animate-pulse" />
                </button>
                <div className="text-xs sm:text-sm text-[#c4c7c5] flex items-center gap-1.5 justify-center">
                  <Headphones className="h-3.5 w-3.5 text-[#a8c7fa]" />
                  <span>Nghe phát âm và chọn nghĩa tiếng Việt đúng:</span>
                </div>
              </div>

              {/* 4 Choices grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pt-1 text-left">
                {choiceOptions.map((opt, i) => {
                  const isSelected = selectedChoice === opt
                  const isCorrectAnswer = opt === currentWord.vietnamese

                  let btnStyle =
                    'bg-[#282a2c]/80 border-[#444746] text-[#e3e3e3] hover:bg-[#282a2c] hover:border-[#a8c7fa]'
                  if (isAnswerRevealed) {
                    if (isCorrectAnswer) {
                      btnStyle =
                        'bg-[#0f5223]/40 border-[#34a853] text-[#c4eed0] font-semibold shadow-md shadow-green-500/10'
                    } else if (isSelected) {
                      btnStyle = 'bg-[#8c1d18]/30 border-[#f2b8b5] text-[#f2b8b5]'
                    } else {
                      btnStyle = 'bg-[#282a2c]/30 border-[#3c4043]/50 text-[#8e918f] opacity-50'
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={isAnswerRevealed}
                      onClick={() => handleSelectChoice(opt)}
                      style={{ borderRadius: 18 }}
                      className={`flex items-center justify-between p-3.5 sm:p-4 border text-xs sm:text-sm font-medium transition-all active:scale-[0.98] cursor-pointer ${btnStyle}`}
                    >
                      <span className="leading-snug">{opt}</span>
                      {isAnswerRevealed && isCorrectAnswer && (
                        <CheckCircle2 className="h-4 w-4 text-[#34a853] shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* D. SCRAMBLE TILES (Xếp mảnh chữ Duolingo) */}
          {exerciseType === 'scramble' && (
            <div className="space-y-4 py-1 text-center">
              <div className="space-y-1">
                <span className="text-xs text-[#fbbc04] font-medium flex items-center justify-center gap-1">
                  <Puzzle className="h-3.5 w-3.5" />
                  Chạm các mảnh ghép để xếp thành từ tiếng Đức:
                </span>
                <div className="text-xl sm:text-2xl font-bold text-white mt-1">
                  &ldquo;{currentWord.vietnamese}&rdquo;
                </div>
              </div>

              {/* Selected Tiles Slot (The Dropzone) */}
              <div
                style={{ borderRadius: 20 }}
                className="min-h-[64px] p-3 bg-[#131314] border-2 border-dashed border-[#444746] flex flex-wrap items-center justify-center gap-2 transition-all"
              >
                {selectedTiles.length === 0 ? (
                  <span className="text-xs text-[#8e918f] italic">
                    Chạm vào các mảnh bên dưới để ghép từ tiếng Đức
                  </span>
                ) : (
                  selectedTiles.map((tile) => (
                    <button
                      key={tile.id}
                      disabled={isAnswerRevealed}
                      onClick={() => handleUnpickTile(tile)}
                      style={{ borderRadius: 14 }}
                      className="px-3.5 py-2 bg-[#004a77] text-[#c2e7ff] border border-[#a8c7fa]/60 font-bold text-sm shadow-sm active:scale-95 transition-all cursor-pointer"
                    >
                      {tile.text}
                    </button>
                  ))
                )}
              </div>

              {/* Available Tiles Pool */}
              <div className="flex flex-wrap items-center justify-center gap-2 pt-1 min-h-[48px]">
                {availableTiles.map((tile) => (
                  <button
                    key={tile.id}
                    disabled={isAnswerRevealed}
                    onClick={() => handlePickTile(tile)}
                    style={{ borderRadius: 14 }}
                    className="px-3.5 py-2 bg-[#282a2c] hover:bg-[#333538] text-white border border-[#444746] font-semibold text-sm shadow-sm active:scale-90 transition-all cursor-pointer"
                  >
                    {tile.text}
                  </button>
                ))}
              </div>

              {/* Action buttons for scramble */}
              {!isAnswerRevealed && (
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="md"
                    onClick={handleReveal}
                    style={{ borderRadius: 9999 }}
                    className="w-full text-xs sm:text-sm text-[#c4c7c5] hover:text-white cursor-pointer h-11"
                  >
                    <Eye className="h-4 w-4 mr-1.5" />
                    Hiện đáp án
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="md"
                    disabled={selectedTiles.length === 0}
                    onClick={handleCheckScramble}
                    style={{ borderRadius: 9999 }}
                    className="w-full text-xs sm:text-sm font-semibold cursor-pointer h-11"
                  >
                    Kiểm tra
                    <ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* E. MULTIPLE CHOICE (Đức ➜ Việt) */}
          {exerciseType === 'choice' && (
            <div className="space-y-4 sm:space-y-5 py-1">
              <div className="space-y-1">
                <span className="text-xs text-[#c4c7c5] font-medium">Chọn nghĩa đúng của từ tiếng Đức:</span>
                <div className="flex items-center justify-center gap-2 sm:gap-3">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight font-outfit">
                    {currentGerman}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => handlePronounce(e)}
                    style={{ borderRadius: 9999 }}
                    className="h-10 w-10 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/40 border border-[#a8c7fa]/30 transition-all cursor-pointer active:scale-95 shrink-0"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
                {currentWord.ipa && (
                  <div className="text-xs font-mono text-[#c4c7c5]">{currentWord.ipa}</div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 pt-1 text-left">
                {choiceOptions.map((opt, i) => {
                  const isSelected = selectedChoice === opt
                  const isCorrectAnswer = opt === currentWord.vietnamese

                  let btnStyle =
                    'bg-[#282a2c]/80 border-[#444746] text-[#e3e3e3] hover:bg-[#282a2c] hover:border-[#a8c7fa]'
                  if (isAnswerRevealed) {
                    if (isCorrectAnswer) {
                      btnStyle =
                        'bg-[#0f5223]/40 border-[#34a853] text-[#c4eed0] font-semibold shadow-md shadow-green-500/10'
                    } else if (isSelected) {
                      btnStyle = 'bg-[#8c1d18]/30 border-[#f2b8b5] text-[#f2b8b5]'
                    } else {
                      btnStyle = 'bg-[#282a2c]/30 border-[#3c4043]/50 text-[#8e918f] opacity-50'
                    }
                  }

                  return (
                    <button
                      key={i}
                      disabled={isAnswerRevealed}
                      onClick={() => handleSelectChoice(opt)}
                      style={{ borderRadius: 18 }}
                      className={`flex items-center justify-between p-3.5 sm:p-4 border text-xs sm:text-sm font-medium transition-all active:scale-[0.98] cursor-pointer ${btnStyle}`}
                    >
                      <span className="leading-snug">{opt}</span>
                      {isAnswerRevealed && isCorrectAnswer && (
                        <CheckCircle2 className="h-4 w-4 text-[#34a853] shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* F. DICTÉE (Nghe chép chính tả tiếng Đức) */}
          {exerciseType === 'dictee' && (
            <div className="flex flex-col items-center space-y-3.5 py-2 sm:py-3">
              <button
                type="button"
                onClick={(e) => handlePronounce(e)}
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 9999,
                  boxShadow: '0 8px 24px -2px rgba(26, 115, 232, 0.35)'
                }}
                className="flex items-center justify-center border-2 border-[#a8c7fa]/60 bg-[#004a77]/40 hover:bg-[#004a77]/60 text-[#a8c7fa] active:scale-95 transition-all cursor-pointer"
                title="Chạm để nghe lại"
              >
                <Volume2 className="h-8 w-8 sm:h-9 sm:w-9 animate-pulse" />
              </button>
              <div className="text-xs sm:text-sm text-[#c4c7c5] flex items-center gap-1.5 justify-center">
                <Headphones className="h-3.5 w-3.5 text-[#a8c7fa]" />
                <span>Nghe và gõ lại chính xác từ tiếng Đức</span>
              </div>
              <div
                style={{ borderRadius: 9999 }}
                className="text-xs sm:text-sm font-semibold text-[#e3e3e3] bg-[#282a2c] px-4 sm:px-6 py-2 border border-[#3c4043]"
              >
                Nghĩa: <span className="text-[#a8c7fa]">{currentWord.vietnamese}</span>
              </div>
            </div>
          )}

          {/* G. REVERSE TYPING (Dịch ngược Việt ➜ Gõ từ tiếng Đức) */}
          {exerciseType === 'reverse' && (
            <div className="space-y-3 sm:space-y-4 py-1 sm:py-2">
              <div className="text-xs sm:text-sm text-[#34a853] font-semibold flex items-center justify-center gap-1.5">
                <Languages className="h-4 w-4" />
                Dịch nghĩa tiếng Việt sau sang từ tiếng Đức (kèm mạo từ nếu có):
              </div>
              <div className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug font-outfit">
                &ldquo;{currentWord.vietnamese}&rdquo;
              </div>
              {currentWord.example && (
                <div
                  style={{ borderRadius: 20 }}
                  className="text-xs sm:text-sm text-[#c4c7c5] bg-[#282a2c]/70 p-3 sm:p-4 border border-[#3c4043] text-left space-y-1"
                >
                  <div className="text-[11px] text-[#8e918f] font-medium">Ngữ cảnh gợi ý:</div>
                  <div className="text-[#e3e3e3] font-medium italic leading-snug">{cloze.maskedSentence}</div>
                  {currentWord.exampleVi && (
                    <div className="text-[#c4c7c5] not-italic text-xs leading-snug">{currentWord.exampleVi}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* H. CLOZE TEST (Điền từ vào câu ngữ cảnh) */}
          {exerciseType === 'cloze' && (
            <div className="space-y-3 py-1 text-left">
              <div className="text-xs sm:text-sm text-[#c4c7c5] font-medium flex items-center gap-1.5">
                <FileQuestion className="h-4 w-4 text-[#a8c7fa]" />
                Điền từ tiếng Đức còn thiếu vào câu:
              </div>
              <div
                style={{ borderRadius: 20 }}
                className="text-sm sm:text-base text-[#e3e3e3] bg-[#282a2c] p-3.5 sm:p-4 border border-[#3c4043] leading-relaxed font-medium"
              >
                {cloze.maskedSentence}
              </div>
              <div
                style={{ borderRadius: 9999 }}
                className="text-xs sm:text-sm text-[#c4c7c5] bg-[#282a2c]/60 px-3.5 py-1.5 border border-[#3c4043]/80 inline-block"
              >
                Nghĩa cần điền: <span className="text-[#e3e3e3] font-semibold">{currentWord.vietnamese}</span>
              </div>
            </div>
          )}
        </div>

        {/* German Special Umlaut Virtual Keypad (ä, ö, ü, ß, Ä, Ö, Ü) */}
        {!isAnswerRevealed && (exerciseType === 'dictee' || exerciseType === 'reverse' || exerciseType === 'cloze') && (
          <div className="mt-2.5 pt-2.5 border-t border-[#3c4043]/60">
            <div className="flex items-center justify-center gap-1 sm:gap-1.5 flex-nowrap overflow-x-auto py-1">
              {GERMAN_UMLAUTS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleInsertUmlaut(char)}
                  style={{ borderRadius: 12 }}
                  className="h-9 min-w-[34px] sm:h-10 sm:min-w-[40px] px-2 sm:px-3 bg-[#282a2c] hover:bg-[#333538] text-[#e3e3e3] hover:text-white border border-[#444746]/70 font-semibold text-xs sm:text-sm active:scale-90 active:bg-[#a8c7fa] active:text-[#041e49] transition-all shadow-sm cursor-pointer shrink-0"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Answer Input for Typing Modes */}
        {!isAnswerRevealed && (exerciseType === 'dictee' || exerciseType === 'reverse' || exerciseType === 'cloze') && (
          <form onSubmit={handleSubmitTyping} className="mt-3.5 space-y-3">
            <div className="relative">
              <Input
                ref={inputRef}
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value)
                  if (fuzzyStatus !== 'idle') setFuzzyStatus('idle')
                }}
                placeholder="Gõ từ tiếng Đức (ví dụ: der Tisch)..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck="false"
                warning={fuzzyStatus === 'typo'}
                error={fuzzyStatus === 'incorrect'}
                className="pr-11 text-center text-base sm:text-lg font-medium h-12 sm:h-14"
              />

              {exerciseType === 'dictee' && (
                <button
                  type="button"
                  onClick={(e) => handlePronounce(e)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#c4c7c5] hover:text-white p-1 cursor-pointer"
                  title="Nghe lại"
                >
                  <Volume2 className="h-5 w-5 text-[#a8c7fa]" />
                </button>
              )}
            </div>

            {/* Typo Warning Banner */}
            {fuzzyStatus === 'typo' && (
              <div
                style={{ borderRadius: 16 }}
                className="flex items-center gap-2 p-3 bg-[#5c3e00]/40 border border-[#f29900]/50 text-[#ffe082] text-xs sm:text-sm animate-in fade-in"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#fbbc04] font-semibold" />
                <span className="font-medium leading-tight">{fuzzyMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2.5 pt-0.5">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleReveal}
                style={{ borderRadius: 9999 }}
                className="w-full text-xs sm:text-sm text-[#c4c7c5] hover:text-white cursor-pointer h-11 sm:h-12"
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Hiện đáp án
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                style={{ borderRadius: 9999 }}
                className="w-full text-xs sm:text-sm font-semibold cursor-pointer h-11 sm:h-12"
              >
                Kiểm tra
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </form>
        )}

        {/* Revealed Card Details & Actionable Next Button */}
        {isAnswerRevealed && (
          <div className="mt-4 pt-4 border-t border-[#3c4043]/80 space-y-3.5 animate-in fade-in-50 duration-200">
            {/* German Word & Pronunciation */}
            <div className="text-center space-y-0.5">
              <div className="flex items-center justify-center gap-2">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-white tracking-tight font-outfit">
                  {currentGerman}
                </h3>
                <button
                  type="button"
                  onClick={(e) => handlePronounce(e)}
                  style={{ borderRadius: 9999 }}
                  className="h-8 w-8 sm:h-9 sm:w-9 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/30 border border-[#a8c7fa]/20 transition-all cursor-pointer active:scale-95 shrink-0"
                  title="Nghe lại"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>

              {currentWord.ipa && (
                <div className="text-xs sm:text-sm font-mono text-[#a8c7fa]/90">{currentWord.ipa}</div>
              )}
            </div>

            {/* Vietnamese Meaning */}
            <div
              style={{ borderRadius: 20 }}
              className="bg-[#282a2c] p-3 sm:p-4 border border-[#3c4043] text-center"
            >
              <div className="text-sm sm:text-base md:text-lg font-semibold text-[#e3e3e3]">
                {currentWord.vietnamese}
              </div>
            </div>

            {/* Example sentence */}
            {currentWord.example && (
              <div
                style={{ borderRadius: 20 }}
                className="bg-[#282a2c]/70 p-3 sm:p-4 border border-[#3c4043]/70 text-xs sm:text-sm space-y-1 text-left"
              >
                <div className="text-[#e3e3e3] font-medium flex items-center justify-between gap-2">
                  <span className="leading-snug">{currentWord.example}</span>
                  <button
                    onClick={(e) => handlePronounce(e, currentWord.example)}
                    className="text-[#a8c7fa] hover:text-[#c2e7ff] p-1 cursor-pointer shrink-0"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
                {currentWord.exampleVi && (
                  <div className="text-[#c4c7c5] italic leading-snug">{currentWord.exampleVi}</div>
                )}
              </div>
            )}

            {/* Result message */}
            <div className="flex items-center justify-center gap-1.5 text-xs sm:text-sm font-medium py-0.5">
              {fuzzyStatus === 'correct' ? (
                <span className="flex items-center gap-1.5 text-[#c4eed0] font-semibold text-center">
                  <CheckCircle2 className="h-4 w-4 text-[#34a853] shrink-0" />
                  Chính xác!{' '}
                  {currentTask.round < currentTask.totalRounds
                    ? `Sẵn sàng cho lần lặp ${currentTask.round + 1}/${currentTask.totalRounds}.`
                    : 'Đã hoàn thành cả 4 vòng lặp của từ này!'}
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[#ffe082] font-semibold text-center">
                  <AlertTriangle className="h-4 w-4 text-[#fbbc04] shrink-0" />
                  Chưa chính xác! Thử thách này sẽ được đẩy xuống cuối phiên để làm lại.
                </span>
              )}
            </div>

            {/* Prominent Primary "Next Card" Button */}
            <div className="pt-0.5">
              <Button
                variant={fuzzyStatus === 'correct' ? 'primary' : 'default'}
                size="lg"
                onClick={() => handleAdvanceTask()}
                style={{ borderRadius: 9999 }}
                className={`w-full h-12 sm:h-14 text-xs sm:text-sm md:text-base font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  fuzzyStatus === 'correct'
                    ? 'shadow-blue-500/20'
                    : 'bg-[#5c3e00] text-[#ffe082] hover:bg-[#7c5800] border border-[#f29900]/40'
                }`}
              >
                <span>
                  {fuzzyStatus === 'correct'
                    ? 'Tiếp tục thử thách tiếp theo'
                    : 'Tiếp tục (Sẽ ôn lại cuối phiên)'}
                </span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const StudySession = StudyView
export default StudyView
