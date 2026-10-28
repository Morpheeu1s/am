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
  Check
} from 'lucide-react'
import type { Word, ReviewQuality, ExerciseType } from '@/types'
import { updateSRS, getIntervalPreview, getMasteryInfo } from '@/lib/srs'
import { updateWord } from '@/lib/db'
import { speakGerman } from '@/lib/speech'
import { playFeedback } from '@/lib/audio'
import { evaluateAnswer, maskSentence } from '@/lib/fuzzy'
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

// German specific Umlauts and Eszett
const GERMAN_UMLAUTS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']

export function StudyView({
  initialWords,
  allWords,
  onSessionComplete,
  onLoadMoreNewWords
}: StudyViewProps) {
  // Session queue
  const [queue, setQueue] = useState<Word[]>(() => [...initialWords])
  const [prevInitialWords, setPrevInitialWords] = useState(initialWords)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [completedCount, setCompletedCount] = useState(0)
  const [totalInitialCount, setTotalInitialCount] = useState(initialWords.length)

  // Session state: 'overview' (pre-session summary) | 'active'
  const [sessionState, setSessionState] = useState<'overview' | 'active'>('overview')
  const [isLoadingMore, setIsLoadingMore] = useState(false)

  // Answer state for typing & interaction
  const [userInput, setUserInput] = useState('')
  const [isIntroDismissed, setIsIntroDismissed] = useState(false)
  const [isAnswerRevealed, setIsAnswerRevealed] = useState(false)
  const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false)
  const [fuzzyStatus, setFuzzyStatus] = useState<'idle' | 'correct' | 'typo' | 'incorrect'>('idle')
  const [fuzzyMessage, setFuzzyMessage] = useState('')

  // Selected option for multiple choice
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null)

  const inputRef = useRef<HTMLInputElement>(null)
  const currentWord = queue[currentIndex]
  const currentGerman = currentWord ? (currentWord.german || currentWord.french || '') : ''

  // Sync state if initialWords reference changed externally
  if (initialWords !== prevInitialWords) {
    setPrevInitialWords(initialWords)
    setQueue([...initialWords])
    setTotalInitialCount(initialWords.length)
    setCurrentIndex(0)
    setCompletedCount(0)
    setIsIntroDismissed(false)
  }

  // Automated mixed exercise assignment (inspired by 4English):
  // - Level 0 brand new card that hasn't been acknowledged: 'new_intro' (discover first)
  // - Other cards automatically rotate through 'choice', 'dictee', 'reverse', 'cloze'
  const exerciseType = useMemo<ExerciseType>(() => {
    if (!currentWord) return 'choice'
    const rep = currentWord.repetition ?? 0

    // If completely new (0 reviews) and user hasn't clicked "Luyện tập ngay" yet:
    if (rep === 0 && !isIntroDismissed) {
      return 'new_intro'
    }

    // Auto-mix pattern based on card ID & index (Quick Choice, Dictée, Reverse, Cloze)
    const mixIndex = ((currentWord.id || 0) + currentIndex) % 4
    if (mixIndex === 0) return 'choice'
    if (mixIndex === 1) return 'dictee'
    if (mixIndex === 2) return 'reverse'
    return 'cloze'
  }, [currentWord, currentIndex, isIntroDismissed])

  // Generate 4 multiple-choice options for 'choice' mode
  const choiceOptions = useMemo<string[]>(() => {
    if (!currentWord || exerciseType !== 'choice') return []
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
    // Deterministic shuffle
    return [...options].sort((a, b) => {
      const hashA = (a.charCodeAt(0) * 31 + baseSeed) % 100
      const hashB = (b.charCodeAt(0) * 31 + baseSeed) % 100
      return hashA - hashB
    })
  }, [currentWord, exerciseType, allWords, currentIndex])

  // Auto-pronounce on card load if session is active
  useEffect(() => {
    if (sessionState === 'active' && currentGerman) {
      if (exerciseType === 'new_intro' || exerciseType === 'dictee' || exerciseType === 'choice') {
        const timer = setTimeout(() => {
          speakGerman(currentGerman, 1.0)
        }, 250)
        return () => clearTimeout(timer)
      }
    }
  }, [sessionState, currentIndex, currentGerman, exerciseType])

  // Focus input automatically for typing modes
  useEffect(() => {
    if (sessionState === 'active' && !isAnswerRevealed && exerciseType !== 'choice' && exerciseType !== 'new_intro') {
      inputRef.current?.focus()
    }
  }, [sessionState, currentIndex, isAnswerRevealed, exerciseType])

  const handlePronounce = (e?: React.MouseEvent, text?: string) => {
    e?.stopPropagation()
    if (currentGerman) {
      playFeedback('click')
      speakGerman(text || currentGerman, 1.0)
    }
  }

  const resetCardInteraction = () => {
    setUserInput('')
    setSelectedChoice(null)
    setIsAnswerRevealed(false)
    setIsAnswerSubmitted(false)
    setFuzzyStatus('idle')
    setFuzzyMessage('')
    setIsIntroDismissed(false)
  }

  // Insert German Umlaut character into input
  const handleInsertUmlaut = (char: string) => {
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

  // Handle typing submission
  const handleSubmitTyping = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!currentWord || isAnswerSubmitted || isAnswerRevealed) return

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
      setFuzzyMessage(evaluation.message || 'Gần đúng rồi, chú ý ký tự Umlaut!')
      inputRef.current?.focus()
    } else {
      playFeedback('error')
      setFuzzyStatus('incorrect')
      setFuzzyMessage('Chưa chính xác!')
      setIsAnswerSubmitted(true)
      setIsAnswerRevealed(true)
      speakGerman(currentGerman, 1.0)
    }
  }

  // Handle multiple-choice selection
  const handleSelectChoice = (option: string) => {
    if (!currentWord || isAnswerRevealed || isAnswerSubmitted) return
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
    }
  }

  // Handle reveal directly
  const handleReveal = () => {
    if (!currentWord) return
    playFeedback('pop')
    setIsAnswerRevealed(true)
    setIsAnswerSubmitted(true)
    setFuzzyStatus('incorrect')
    setFuzzyMessage('Đã mở đáp án')
    speakGerman(currentGerman, 1.0)
  }

  // Process SM-2 rating & advance card
  const handleRate = async (quality: ReviewQuality) => {
    if (!currentWord || !currentWord.id) return

    playFeedback('click')
    const isSuccess = quality >= 3
    const srsUpdate = updateSRS(currentWord, isSuccess, quality)

    // Save to IndexedDB
    await updateWord(currentWord.id, {
      repetition: srsUpdate.repetition,
      interval: srsUpdate.interval,
      easeFactor: srsUpdate.easeFactor,
      dueDate: srsUpdate.dueDate,
      mistakes: srsUpdate.mistakes
    })

    resetCardInteraction()

    // If card was failed (quality < 3), push back to the end of today's queue
    if (!isSuccess) {
      const updatedQueue = [...queue]
      const failedCard: Word = {
        ...currentWord,
        repetition: srsUpdate.repetition,
        interval: srsUpdate.interval,
        easeFactor: srsUpdate.easeFactor,
        dueDate: srsUpdate.dueDate,
        mistakes: srsUpdate.mistakes
      }
      updatedQueue.push(failedCard)
      setQueue(updatedQueue)
      setCurrentIndex((prev) => prev + 1)
    } else {
      setCompletedCount((prev) => prev + 1)
      const nextIndex = currentIndex + 1
      setCurrentIndex(nextIndex)

      if (nextIndex >= queue.length) {
        triggerConfetti()
        onSessionComplete?.()
      }
    }
  }

  const handleLoadMore = async () => {
    if (!onLoadMoreNewWords) return
    setIsLoadingMore(true)
    playFeedback('click')
    try {
      const res = await onLoadMoreNewWords()
      const newWords = Array.isArray(res) ? res : []
      if (newWords.length > 0) {
        setQueue(newWords)
        setTotalInitialCount(newWords.length)
        setCurrentIndex(0)
        setCompletedCount(0)
        resetCardInteraction()
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

  // 1. Pre-session Overview screen (Material 3 & Google Labs style)
  if (sessionState === 'overview') {
    const dueCount = queue.filter((w) => (w.repetition ?? 0) > 0).length
    const newCount = queue.filter((w) => (w.repetition ?? 0) === 0).length

    return (
      <div className="w-full max-w-xl md:max-w-2xl mx-auto space-y-5 animate-in fade-in duration-300 pb-16">
        {/* Google Labs Hero Card */}
        <div
          style={{
            borderRadius: 32,
            backgroundColor: '#1e1f20',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)'
          }}
          className="relative overflow-hidden p-6 md:p-8"
        >
          {/* Subtle Google Labs chromatic background glow */}
          <div className="absolute -top-24 -right-24 w-72 h-72 bg-gradient-to-br from-[#1a73e8]/25 via-[#7c3aed]/20 to-[#d946ef]/15 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center justify-between pb-4">
              <span
                style={{ borderRadius: 9999 }}
                className="text-xs font-semibold uppercase tracking-wider text-[#a8c7fa] bg-[#004a77]/40 px-3.5 py-1 border border-[#004a77]"
              >
                Goethe-Zertifikat A1: Start Deutsch 1
              </span>
              <span
                style={{ borderRadius: 9999 }}
                className="text-xs text-[#c4c7c5] font-mono px-3 py-1 bg-[#282a2c] border border-[#3c4043]"
              >
                Tổng {queue.length} từ
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight leading-tight mt-1 mb-2 font-outfit">
              Học tiếng Đức chuẩn viện Goethe !
            </h2>
            <p className="text-sm text-[#c4c7c5] leading-relaxed mb-6">
              Hệ thống tự động pha trộn thông minh trắc nghiệm phản xạ, Dictée nghe chép chính tả và điền ngữ cảnh theo đề thi Start Deutsch 1.
            </p>

            <div className="grid grid-cols-2 gap-3.5 mb-6">
              <div
                style={{ borderRadius: 24 }}
                className="border border-[#3c4043] bg-[#282a2c] p-4 md:p-5 transition-colors hover:border-[#a8c7fa]/50"
              >
                <div className="text-3xl font-extrabold text-[#a8c7fa] font-outfit">{newCount}</div>
                <div className="text-xs text-[#c4c7c5] font-medium mt-1.5">Từ mới từ kho</div>
              </div>
              <div
                style={{ borderRadius: 24 }}
                className="border border-[#3c4043] bg-[#282a2c] p-4 md:p-5 transition-colors hover:border-[#ffe082]/50"
              >
                <div className="text-3xl font-extrabold text-[#ffe082] font-outfit">{dueCount}</div>
                <div className="text-xs text-[#c4c7c5] font-medium mt-1.5">Từ cũ cần ôn</div>
              </div>
            </div>

            <Button
              variant="labs"
              size="lg"
              onClick={() => {
                playFeedback('success')
                setSessionState('active')
              }}
              style={{ borderRadius: 9999 }}
              className="w-full h-14 text-base font-bold shadow-lg shadow-indigo-500/25 group cursor-pointer"
            >
              <Play className="h-5 w-5 mr-2 fill-current transition-transform group-hover:scale-110" />
              Bắt đầu học ngay
            </Button>
          </div>
        </div>

        {/* Level Mastery Breakdown Info (Material 3 Card) */}
        <div
          style={{
            borderRadius: 28,
            backgroundColor: '#1e1f20',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
          }}
          className="p-5 md:p-6 space-y-4"
        >
          <div className="flex items-center justify-between text-sm font-semibold text-[#e3e3e3]">
            <span>Cấp độ thông thạo từ vựng (SRS Levels)</span>
            <Sparkles className="h-4 w-4 text-[#fbbc04]" />
          </div>
          <div className="space-y-3 text-xs md:text-sm">
            <div className="flex items-center justify-between text-[#c4c7c5]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#8e918f]" />
                Level 0 - Kho từ
              </span>
              <span className="text-xs text-[#8e918f]">Chưa học (Nằm trong kho)</span>
            </div>
            <div className="flex items-center justify-between text-[#c4c7c5]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#a8c7fa]" />
                Level 1 - Khởi đầu
              </span>
              <span className="text-xs text-[#a8c7fa]">Nhớ 1 lần (Ôn lại sau 1 ngày)</span>
            </div>
            <div className="flex items-center justify-between text-[#c4c7c5]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#c2e7ff]" />
                Level 2 - Đang nhớ
              </span>
              <span className="text-xs text-[#c2e7ff]">Nhớ 2-3 lần (Ôn lại sau 6 ngày)</span>
            </div>
            <div className="flex items-center justify-between text-[#c4c7c5]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ffe082]" />
                Level 3 - Khắc sâu
              </span>
              <span className="text-xs text-[#ffe082]">Nhớ 4-5 lần (Trí nhớ trung hạn)</span>
            </div>
            <div className="flex items-center justify-between text-[#c4c7c5]">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#c4eed0]" />
                Level 4 - Thành thạo
              </span>
              <span className="text-xs text-[#c4eed0]">Nhớ 6+ lần (Trí nhớ dài hạn)</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // 2. All cards completed Celebration view
  if (!currentWord || currentIndex >= queue.length) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center animate-in fade-in zoom-in-95 duration-300 w-full max-w-xl md:max-w-2xl mx-auto pb-16">
        <div className="relative mb-6">
          <div className="h-24 w-24 rounded-full bg-gradient-to-tr from-[#0f5223]/30 via-[#004a77]/30 to-[#381e72]/30 flex items-center justify-center border border-[#34a853]/40 shadow-xl shadow-green-500/10">
            <Trophy className="h-12 w-12 text-[#c4eed0]" />
          </div>
          <Sparkles className="absolute -top-1 -right-1 h-6 w-6 text-[#fbbc04] animate-bounce" />
        </div>

        <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2 font-outfit">
          Wunderbar ! Hoàn thành đợt học!
        </h2>
        <p className="text-sm text-[#c4c7c5] max-w-sm mb-6 leading-relaxed">
          Tất cả {totalInitialCount} từ tiếng Đức trong phiên đã được ghi nhận vào thuật toán Spaced Repetition (SM-2).
        </p>

        <div className="grid grid-cols-2 gap-3.5 w-full max-w-sm mb-8">
          <div
            style={{ borderRadius: 24 }}
            className="border border-[#3c4043] bg-[#1e1f20] p-4 md:p-5"
          >
            <div className="text-3xl font-extrabold text-white font-outfit">{totalInitialCount}</div>
            <div className="text-xs text-[#c4c7c5] font-medium mt-1.5">Từ đã hoàn thành</div>
          </div>
          <div
            style={{ borderRadius: 24 }}
            className="border border-[#3c4043] bg-[#1e1f20] p-4 md:p-5"
          >
            <div className="text-3xl font-extrabold text-[#c4eed0] font-outfit">100%</div>
            <div className="text-xs text-[#c4c7c5] font-medium mt-1.5">Mục tiêu đợt học</div>
          </div>
        </div>

        <div className="space-y-3 w-full max-w-sm">
          {onLoadMoreNewWords && (
            <Button
              variant="primary"
              size="lg"
              disabled={isLoadingMore}
              style={{ borderRadius: 9999 }}
              className="w-full font-bold shadow-md shadow-blue-500/20 cursor-pointer h-13"
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
              if (initialWords.length > 0) {
                setQueue([...initialWords])
                setCurrentIndex(0)
                setCompletedCount(0)
                resetCardInteraction()
                setSessionState('active')
              }
            }}
          >
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Ôn lại phiên này
          </Button>
        </div>
      </div>
    )
  }

  // 3. Active Interactive Card Session
  const cloze = maskSentence(currentWord.example || '', currentGerman)
  const mastery = getMasteryInfo(currentWord.repetition ?? 0)

  return (
    <div className="flex flex-col w-full max-w-xl md:max-w-2xl mx-auto space-y-5 pb-16 animate-in fade-in duration-200">
      {/* Session Progress Header */}
      <div className="space-y-2 px-2">
        <div className="flex items-center justify-between text-xs text-[#c4c7c5] font-medium">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#a8c7fa] animate-pulse" />
            <span>Thẻ {currentIndex + 1} / {queue.length}</span>
            {queue.length > totalInitialCount && (
              <span className="text-[#ffe082] font-normal">
                (+{queue.length - totalInitialCount} làm lại)
              </span>
            )}
          </div>
          <span className="font-mono text-[#a8c7fa] font-semibold text-sm">
            {Math.round((completedCount / Math.max(1, totalInitialCount)) * 100)}%
          </span>
        </div>
        <Progress value={completedCount} max={Math.max(1, totalInitialCount)} />
      </div>

      {/* Main Flashcard Card (Google Labs Material 3 Surface 32px Squircle) */}
      <div
        style={{
          borderRadius: 32,
          backgroundColor: '#1e1f20',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)'
        }}
        className="relative p-6 md:p-8 transition-all duration-300"
      >
        {/* Top Info Bar: Category + Mastery Level Chips */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-1.5">
            <span
              style={{ borderRadius: 9999 }}
              className={`text-xs font-semibold px-3.5 py-1 border ${mastery.badgeClass}`}
            >
              {mastery.shortLabel} · {mastery.label}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span
              style={{ borderRadius: 9999 }}
              className="text-xs px-3.5 py-1 bg-[#282a2c] text-[#c4c7c5] font-medium border border-[#444746]/60"
            >
              {exerciseType === 'new_intro' && '✨ Khám phá từ mới'}
              {exerciseType === 'choice' && '⚡ Trắc nghiệm nhanh'}
              {exerciseType === 'dictee' && '🎧 Dictée tiếng Đức'}
              {exerciseType === 'reverse' && '🇩🇪 Dịch Việt ➜ Đức'}
              {exerciseType === 'cloze' && '🧩 Điền chỗ trống'}
            </span>
          </div>
        </div>

        {/* Content Area Based on Auto-Assigned Exercise */}
        <div className="py-2 text-center">
          {/* A. NEW WORD INTRO (Khám phá từ mới đầu tiên) */}
          {exerciseType === 'new_intro' && (
            <div className="space-y-5 py-2 text-center animate-in fade-in duration-200">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-[#a8c7fa] uppercase tracking-wider">
                  Khám phá từ mới (Goethe A1)
                </span>
                <div className="flex items-center justify-center gap-3">
                  <h2 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-outfit">
                    {currentGerman}
                  </h2>
                  <button
                    type="button"
                    onClick={(e) => handlePronounce(e)}
                    style={{ borderRadius: 9999 }}
                    className="h-11 w-11 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/40 border border-[#a8c7fa]/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
                {currentWord.ipa && (
                  <div className="text-sm font-mono text-[#a8c7fa]/90">{currentWord.ipa}</div>
                )}
              </div>

              <div
                style={{ borderRadius: 24 }}
                className="bg-[#282a2c] p-4 md:p-5 border border-[#3c4043]"
              >
                <div className="text-lg md:text-xl font-bold text-[#e3e3e3]">{currentWord.vietnamese}</div>
              </div>

              {currentWord.example && (
                <div
                  style={{ borderRadius: 24 }}
                  className="bg-[#282a2c]/70 p-4 border border-[#3c4043]/70 text-xs md:text-sm space-y-1.5 text-left"
                >
                  <div className="text-[#e3e3e3] font-medium flex items-center justify-between">
                    <span>{currentWord.example}</span>
                    <button
                      onClick={(e) => handlePronounce(e, currentWord.example)}
                      className="text-[#a8c7fa] hover:text-[#c2e7ff] p-1 cursor-pointer"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                  {currentWord.exampleVi && (
                    <div className="text-[#c4c7c5] italic">{currentWord.exampleVi}</div>
                  )}
                </div>
              )}

              {/* Action Buttons for New Word Intro */}
              <div className="space-y-3 pt-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => {
                    playFeedback('click')
                    setIsIntroDismissed(true)
                  }}
                  style={{ borderRadius: 9999 }}
                  className="w-full font-bold h-13 text-sm shadow-md shadow-blue-500/20 cursor-pointer"
                >
                  <span>Luyện tập từ này ngay</span>
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>

                <Button
                  variant="outline"
                  size="md"
                  onClick={() => {
                    handleRate(4)
                  }}
                  style={{ borderRadius: 9999 }}
                  className="w-full text-xs text-[#c4c7c5] hover:text-white border-[#444746] cursor-pointer h-11"
                >
                  <Check className="h-4 w-4 mr-1.5 text-[#34a853]" />
                  Tôi đã thuộc từ này (Từ tiếp theo)
                </Button>
              </div>
            </div>
          )}

          {/* B. MULTIPLE CHOICE (Google Labs quick reflex) */}
          {exerciseType === 'choice' && (
            <div className="space-y-5 py-2">
              <div className="space-y-1">
                <span className="text-xs text-[#c4c7c5] font-medium">Chọn nghĩa đúng của từ tiếng Đức:</span>
                <div className="flex items-center justify-center gap-3">
                  <h3 className="text-3xl md:text-4xl font-extrabold text-white tracking-tight font-outfit">
                    {currentGerman}
                  </h3>
                  <button
                    type="button"
                    onClick={(e) => handlePronounce(e)}
                    style={{ borderRadius: 9999 }}
                    className="h-11 w-11 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/40 border border-[#a8c7fa]/30 transition-all cursor-pointer active:scale-95"
                  >
                    <Volume2 className="h-5 w-5" />
                  </button>
                </div>
                {currentWord.ipa && (
                  <div className="text-xs font-mono text-[#c4c7c5]">{currentWord.ipa}</div>
                )}
              </div>

              {/* 4 Choices grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-left">
                {choiceOptions.map((opt, i) => {
                  const isSelected = selectedChoice === opt
                  const isCorrectAnswer = opt === currentWord.vietnamese

                  let btnStyle = 'bg-[#282a2c]/80 border-[#444746] text-[#e3e3e3] hover:bg-[#282a2c] hover:border-[#a8c7fa]'
                  if (isAnswerRevealed) {
                    if (isCorrectAnswer) {
                      btnStyle = 'bg-[#0f5223]/40 border-[#34a853] text-[#c4eed0] font-semibold shadow-md shadow-green-500/10'
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
                      style={{ borderRadius: 20 }}
                      className={`flex items-center justify-between p-4 border text-sm font-medium transition-all active:scale-[0.98] cursor-pointer ${btnStyle}`}
                    >
                      <span>{opt}</span>
                      {isAnswerRevealed && isCorrectAnswer && (
                        <CheckCircle2 className="h-4 w-4 text-[#34a853] shrink-0 ml-2" />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* C. DICTÉE (Nghe chép chính tả tiếng Đức) */}
          {exerciseType === 'dictee' && (
            <div className="flex flex-col items-center space-y-4 py-4">
              <button
                type="button"
                onClick={(e) => handlePronounce(e)}
                style={{
                  width: 88,
                  height: 88,
                  borderRadius: 9999,
                  boxShadow: '0 8px 24px -2px rgba(26, 115, 232, 0.35)'
                }}
                className="flex items-center justify-center border-2 border-[#a8c7fa]/60 bg-[#004a77]/40 hover:bg-[#004a77]/60 text-[#a8c7fa] active:scale-95 transition-all cursor-pointer"
              >
                <Volume2 className="h-10 w-10 animate-pulse" />
              </button>
              <div className="text-xs md:text-sm text-[#c4c7c5] flex items-center gap-2 justify-center">
                <Headphones className="h-4 w-4 text-[#a8c7fa]" />
                <span>Nghe và gõ lại từ tiếng Đức</span>
              </div>
              <div
                style={{ borderRadius: 9999 }}
                className="text-sm md:text-base font-semibold text-[#e3e3e3] bg-[#282a2c] px-6 py-2.5 border border-[#3c4043]"
              >
                Nghĩa: <span className="text-[#a8c7fa]">{currentWord.vietnamese}</span>
              </div>
            </div>
          )}

          {/* D. REVERSE (Dịch Việt ➜ Đức) */}
          {exerciseType === 'reverse' && (
            <div className="space-y-4 py-2">
              <div className="text-xs md:text-sm text-[#c4c7c5] font-medium flex items-center justify-center gap-2">
                <Languages className="h-4 w-4 text-[#a8c7fa]" />
                Dịch nghĩa sau sang tiếng Đức:
              </div>
              <div className="text-2xl md:text-3xl font-extrabold text-white tracking-tight leading-snug font-outfit">
                \"{currentWord.vietnamese}\"
              </div>
              {currentWord.example && (
                <div
                  style={{ borderRadius: 24 }}
                  className="text-xs md:text-sm text-[#c4c7c5] bg-[#282a2c]/70 p-4 border border-[#3c4043] text-left space-y-1.5"
                >
                  <div className="text-xs text-[#8e918f] font-medium">Ngữ cảnh tiếng Đức:</div>
                  <div className="text-[#e3e3e3] font-medium italic">{cloze.maskedSentence}</div>
                  {currentWord.exampleVi && (
                    <div className="text-[#c4c7c5] not-italic text-xs">{currentWord.exampleVi}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* E. CLOZE TEST (Điền chỗ trống) */}
          {exerciseType === 'cloze' && (
            <div className="space-y-3.5 py-1 text-left">
              <div className="text-xs md:text-sm text-[#c4c7c5] font-medium flex items-center gap-2">
                <FileQuestion className="h-4 w-4 text-[#a8c7fa]" />
                Điền từ tiếng Đức vào chỗ trống:
              </div>
              <div
                style={{ borderRadius: 24 }}
                className="text-base text-[#e3e3e3] bg-[#282a2c] p-5 border border-[#3c4043] leading-relaxed font-medium"
              >
                {cloze.maskedSentence}
              </div>
              <div
                style={{ borderRadius: 9999 }}
                className="text-xs md:text-sm text-[#c4c7c5] bg-[#282a2c]/60 px-4 py-2 border border-[#3c4043]/80 inline-block"
              >
                Gợi ý nghĩa: <span className="text-[#e3e3e3] font-semibold">{currentWord.vietnamese}</span>
              </div>
            </div>
          )}
        </div>

        {/* German Special Umlaut Virtual Keypad (ä, ö, ü, ß, Ä, Ö, Ü) */}
        {!isAnswerRevealed && (exerciseType === 'dictee' || exerciseType === 'reverse' || exerciseType === 'cloze') && (
          <div className="mt-3 pt-3 border-t border-[#3c4043]/60">
            <div className="flex items-center justify-center gap-2 flex-wrap">
              {GERMAN_UMLAUTS.map((char) => (
                <button
                  key={char}
                  type="button"
                  onClick={() => handleInsertUmlaut(char)}
                  style={{ borderRadius: 14 }}
                  className="h-10 min-w-[38px] px-3 bg-[#282a2c] hover:bg-[#333538] text-[#e3e3e3] hover:text-white border border-[#444746]/70 font-semibold text-sm active:scale-90 active:bg-[#a8c7fa] active:text-[#041e49] transition-all shadow-sm cursor-pointer"
                >
                  {char}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Interactive Answer Input for Typing Modes */}
        {!isAnswerRevealed && (exerciseType === 'dictee' || exerciseType === 'reverse' || exerciseType === 'cloze') && (
          <form onSubmit={handleSubmitTyping} className="mt-4 space-y-3.5">
            <div className="relative">
              <Input
                ref={inputRef}
                value={userInput}
                onChange={(e) => {
                  setUserInput(e.target.value)
                  if (fuzzyStatus !== 'idle') setFuzzyStatus('idle')
                }}
                placeholder="Gõ từ tiếng Đức..."
                autoComplete="off"
                autoCorrect="off"
                spellCheck="false"
                warning={fuzzyStatus === 'typo'}
                error={fuzzyStatus === 'incorrect'}
                className="pr-12 text-center text-lg font-medium h-14"
              />

              {exerciseType === 'dictee' && (
                <button
                  type="button"
                  onClick={(e) => handlePronounce(e)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-[#c4c7c5] hover:text-white p-1 cursor-pointer"
                >
                  <Volume2 className="h-5 w-5 text-[#a8c7fa]" />
                </button>
              )}
            </div>

            {/* Typo Warning Banner */}
            {fuzzyStatus === 'typo' && (
              <div
                style={{ borderRadius: 20 }}
                className="flex items-center gap-2.5 p-3.5 bg-[#5c3e00]/40 border border-[#f29900]/50 text-[#ffe082] text-xs md:text-sm animate-in fade-in"
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#fbbc04]" />
                <span className="font-medium">{fuzzyMessage}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                type="button"
                variant="outline"
                size="md"
                onClick={handleReveal}
                style={{ borderRadius: 9999 }}
                className="w-full text-xs md:text-sm text-[#c4c7c5] hover:text-white cursor-pointer h-12"
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Hiện đáp án
              </Button>

              <Button
                type="submit"
                variant="primary"
                size="md"
                style={{ borderRadius: 9999 }}
                className="w-full text-xs md:text-sm font-semibold cursor-pointer h-12"
              >
                Kiểm tra
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </form>
        )}

        {/* Revealed Card Details & Actionable Next Button */}
        {isAnswerRevealed && (
          <div className="mt-5 pt-5 border-t border-[#3c4043]/80 space-y-4 animate-in fade-in-50 duration-200">
            {/* German Word & Pronunciation */}
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-2.5">
                <h3 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight font-outfit">
                  {currentGerman}
                </h3>
                <button
                  type="button"
                  onClick={(e) => handlePronounce(e)}
                  style={{ borderRadius: 9999 }}
                  className="h-9 w-9 flex items-center justify-center text-[#a8c7fa] hover:bg-[#004a77]/30 border border-[#a8c7fa]/20 transition-all cursor-pointer active:scale-95"
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>

              {currentWord.ipa && (
                <div className="text-sm font-mono text-[#a8c7fa]/90">{currentWord.ipa}</div>
              )}
            </div>

            {/* Vietnamese Meaning */}
            <div
              style={{ borderRadius: 24 }}
              className="bg-[#282a2c] p-4 border border-[#3c4043] text-center"
            >
              <div className="text-base md:text-lg font-semibold text-[#e3e3e3]">
                {currentWord.vietnamese}
              </div>
            </div>

            {/* Example sentence */}
            {currentWord.example && (
              <div
                style={{ borderRadius: 24 }}
                className="bg-[#282a2c]/70 p-4 border border-[#3c4043]/70 text-xs md:text-sm space-y-1.5 text-left"
              >
                <div className="text-[#e3e3e3] font-medium flex items-center justify-between">
                  <span>{currentWord.example}</span>
                  <button
                    onClick={(e) => handlePronounce(e, currentWord.example)}
                    className="text-[#a8c7fa] hover:text-[#c2e7ff] p-1 cursor-pointer"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
                {currentWord.exampleVi && (
                  <div className="text-[#c4c7c5] italic">{currentWord.exampleVi}</div>
                )}
              </div>
            )}

            {/* Result message */}
            <div className="flex items-center justify-center gap-2 text-xs md:text-sm font-medium py-1">
              {fuzzyStatus === 'correct' ? (
                <span className="flex items-center gap-1.5 text-[#c4eed0] font-semibold">
                  <CheckCircle2 className="h-4 w-4 text-[#34a853]" />
                  Chính xác! Bạn nhớ từ này rất tốt.
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-[#ffe082] font-semibold">
                  <AlertTriangle className="h-4 w-4 text-[#fbbc04]" />
                  Từ này sẽ được đưa vào hàng đợi ôn lại cuối phiên!
                </span>
              )}
            </div>

            {/* Prominent Primary "Next Word" Button (Học từ tiếp theo) */}
            <div className="pt-1">
              <Button
                variant={fuzzyStatus === 'correct' ? 'primary' : 'default'}
                size="lg"
                onClick={() => {
                  handleRate(fuzzyStatus === 'correct' ? 4 : 1)
                }}
                style={{ borderRadius: 9999 }}
                className={`w-full h-14 text-sm md:text-base font-bold shadow-lg flex items-center justify-center gap-2 cursor-pointer ${
                  fuzzyStatus === 'correct'
                    ? 'shadow-blue-500/20'
                    : 'bg-[#5c3e00] text-[#ffe082] hover:bg-[#7c5800] border border-[#f29900]/40'
                }`}
              >
                <span>{fuzzyStatus === 'correct' ? 'Học từ tiếp theo' : 'Tiếp tục (Luyện lại sau)'}</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>

            {/* Optional SM-2 Detailed Rating Row */}
            <div className="pt-3 border-t border-[#3c4043]/50">
              <div className="text-xs text-[#8e918f] text-center mb-2 font-medium">
                Hoặc tự điều chỉnh độ khó thuật toán (SM-2):
              </div>
              <div className="grid grid-cols-4 gap-2">
                {/* Quality 1 (Quên) */}
                <button
                  onClick={() => handleRate(1)}
                  style={{ borderRadius: 16 }}
                  className="flex flex-col items-center justify-center py-2.5 px-1 bg-[#410002]/40 border border-[#93000a]/50 text-[#ffdad6] hover:bg-[#410002]/70 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold">Quên</span>
                  <span className="text-[10px] text-[#ffb4ab] mt-0.5">
                    {getIntervalPreview(currentWord, 1)}
                  </span>
                </button>

                {/* Quality 3 (Khó) */}
                <button
                  onClick={() => handleRate(3)}
                  style={{ borderRadius: 16 }}
                  className="flex flex-col items-center justify-center py-2.5 px-1 bg-[#2e1500]/40 border border-[#7c5800]/50 text-[#ffe082] hover:bg-[#2e1500]/70 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold">Khó</span>
                  <span className="text-[10px] text-[#ffd062] mt-0.5">
                    {getIntervalPreview(currentWord, 3)}
                  </span>
                </button>

                {/* Quality 4 (Tốt) */}
                <button
                  onClick={() => handleRate(4)}
                  style={{ borderRadius: 16 }}
                  className="flex flex-col items-center justify-center py-2.5 px-1 bg-[#004a77]/40 border border-[#004a77]/80 text-[#c2e7ff] hover:bg-[#004a77]/70 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold">Tốt</span>
                  <span className="text-[10px] text-[#a8c7fa] mt-0.5">
                    {getIntervalPreview(currentWord, 4)}
                  </span>
                </button>

                {/* Quality 5 (Dễ) */}
                <button
                  onClick={() => handleRate(5)}
                  style={{ borderRadius: 16 }}
                  className="flex flex-col items-center justify-center py-2.5 px-1 bg-[#003912]/40 border border-[#0f5223]/80 text-[#c4eed0] hover:bg-[#003912]/70 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="text-xs font-bold">Dễ</span>
                  <span className="text-[10px] text-[#97f5b5] mt-0.5">
                    {getIntervalPreview(currentWord, 5)}
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export const StudySession = StudyView
export default StudyView
