import { useState, useMemo } from 'react'
import {
  TrendingUp,
  Brain,
  Trophy,
  Target,
  Clock,
  Sparkles,
  AlertTriangle,
  Volume2,
  Search,
  Calendar,
  Layers,
  ArrowUpRight
} from 'lucide-react'
import type { Word } from '@/types'
import { getMasteryInfo, getTodayDateString } from '@/lib/srs'
import { speakGerman, unlockAudio } from '@/lib/speech'
import { playFeedback } from '@/lib/audio'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

interface StatsViewProps {
  words: Word[]
  onSwitchToStudy?: () => void
}

type WordFilterMode = 'all-learned' | 'mastered' | 'learning' | 'mistakes' | 'unlearned'

export function StatsView({ words, onSwitchToStudy }: StatsViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterMode, setFilterMode] = useState<WordFilterMode>('all-learned')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  const today = getTodayDateString()

  // Distinct categories
  const categories = useMemo(() => {
    return Array.from(new Set(words.map((w) => w.category || 'chung'))).sort()
  }, [words])

  // Calculate comprehensive metrics
  const stats = useMemo(() => {
    const total = words.length
    let learnedCount = 0
    let dueTodayCount = 0
    let totalMistakes = 0
    let totalEase = 0
    let easeCount = 0

    const levels = {
      level0: 0, // Unlearned (repetition = 0)
      level1: 0, // 1 rep
      level2: 0, // 2-3 reps
      level3: 0, // 4-5 reps
      level4: 0  // 6+ reps (Mastered)
    }

    const forecast = {
      dueNow: 0,
      tomorrow: 0,
      next3Days: 0,
      next7Days: 0,
      later: 0
    }

    // Categories progress tracker
    const categoryMap: Record<string, { total: number; learned: number; mastered: number }> = {}

    // Date calculations for forecast
    const todayMs = new Date(today).getTime()
    const oneDayMs = 24 * 60 * 60 * 1000

    for (const w of words) {
      const rep = w.repetition ?? 0
      const mistakes = w.mistakes ?? 0
      totalMistakes += mistakes

      const cat = w.category || 'chung'
      if (!categoryMap[cat]) {
        categoryMap[cat] = { total: 0, learned: 0, mastered: 0 }
      }
      categoryMap[cat].total++

      if (rep === 0) {
        levels.level0++
      } else {
        learnedCount++
        totalEase += w.easeFactor || 2.5
        easeCount++
        categoryMap[cat].learned++

        if (rep >= 6) {
          levels.level4++
          categoryMap[cat].mastered++
        } else if (rep >= 4) {
          levels.level3++
        } else if (rep >= 2) {
          levels.level2++
        } else {
          levels.level1++
        }

        // Forecast
        const dueMs = new Date(w.dueDate).getTime()
        const diffDays = Math.round((dueMs - todayMs) / oneDayMs)

        if (diffDays <= 0) {
          forecast.dueNow++
          dueTodayCount++
        } else if (diffDays === 1) {
          forecast.tomorrow++
        } else if (diffDays <= 3) {
          forecast.next3Days++
        } else if (diffDays <= 7) {
          forecast.next7Days++
        } else {
          forecast.later++
        }
      }
    }

    const learnedPercent = total > 0 ? Math.round((learnedCount / total) * 100) : 0
    const masteredPercent = total > 0 ? Math.round((levels.level4 / total) * 100) : 0
    const avgEase = easeCount > 0 ? (totalEase / easeCount).toFixed(2) : '2.50'

    // Retention rate: words with repetition >= 1 and 0 mistakes or low mistake ratio
    const learnedWords = words.filter((w) => (w.repetition ?? 0) > 0)
    const zeroMistakesCount = learnedWords.filter((w) => (w.mistakes ?? 0) === 0).length
    const retentionRate =
      learnedWords.length > 0 ? Math.round((zeroMistakesCount / learnedWords.length) * 100) : 100

    // Top most mistaken words
    const mostMistaken = [...words]
      .filter((w) => (w.mistakes ?? 0) > 0)
      .sort((a, b) => (b.mistakes ?? 0) - (a.mistakes ?? 0))
      .slice(0, 5)

    // Sorted categories
    const categoriesProgress = Object.entries(categoryMap)
      .map(([name, data]) => ({
        name,
        total: data.total,
        learned: data.learned,
        mastered: data.mastered,
        percent: data.total > 0 ? Math.round((data.learned / data.total) * 100) : 0
      }))
      .sort((a, b) => b.total - a.total)

    return {
      total,
      learnedCount,
      learnedPercent,
      masteredCount: levels.level4,
      masteredPercent,
      dueTodayCount,
      totalMistakes,
      avgEase,
      retentionRate,
      levels,
      forecast,
      mostMistaken,
      categoriesProgress
    }
  }, [words, today])

  // Filter words for the interactive drilldown list
  const filteredWords = useMemo(() => {
    return words.filter((w) => {
      const german = (w.german || w.french || '').toLowerCase()
      const vi = (w.vietnamese || '').toLowerCase()
      const q = searchTerm.toLowerCase().trim()

      const matchesSearch = !q || german.includes(q) || vi.includes(q)
      if (!matchesSearch) return false

      if (selectedCategory !== 'all' && (w.category || 'chung') !== selectedCategory) {
        return false
      }

      const rep = w.repetition ?? 0
      if (filterMode === 'all-learned') {
        return rep > 0
      }
      if (filterMode === 'mastered') {
        return rep >= 6
      }
      if (filterMode === 'learning') {
        return rep >= 1 && rep <= 5
      }
      if (filterMode === 'mistakes') {
        return (w.mistakes ?? 0) > 0
      }
      if (filterMode === 'unlearned') {
        return rep === 0
      }
      return true
    })
  }, [words, searchTerm, filterMode, selectedCategory])

  const handlePronounce = (e: React.MouseEvent, text: string) => {
    e.stopPropagation()
    unlockAudio()
    playFeedback('click')
    speakGerman(text, 1.0)
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 24,
    backgroundColor: '#1e1f20',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
  }

  return (
    <div className="w-full max-w-xl md:max-w-2xl mx-auto space-y-4 sm:space-y-5 pb-20 animate-in fade-in duration-200">
      {/* 1. Hero Overall Progress Card (Material 3 & Google Labs aesthetic) */}
      <div
        style={{
          borderRadius: 28,
          backgroundColor: '#1e1f20',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px -4px rgba(0, 0, 0, 0.5)'
        }}
        className="relative overflow-hidden p-4 sm:p-6"
      >
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-[#1a73e8]/20 via-[#7c3aed]/20 to-[#34a853]/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span
                style={{ borderRadius: 9999 }}
                className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-[#a8c7fa] bg-[#004a77]/40 px-3 py-0.5 border border-[#004a77]"
              >
                Tiến độ học Goethe A1
              </span>
            </div>
            <span
              style={{ borderRadius: 9999 }}
              className="text-xs text-[#c4c7c5] font-mono px-2.5 py-0.5 bg-[#282a2c] border border-[#3c4043]"
            >
              {stats.learnedCount} / {stats.total} từ
            </span>
          </div>

          {/* Large percentage display */}
          <div className="flex items-baseline justify-between">
            <div>
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight font-outfit">
                {stats.learnedPercent}%
              </div>
              <p className="text-xs sm:text-sm text-[#c4c7c5] mt-0.5 font-medium">
                Đã tiếp nạp vào trí nhớ từ kho Goethe-Zertifikat A1
              </p>
            </div>
            <div className="text-right">
              <span className="text-xl sm:text-2xl font-bold text-[#c4eed0] font-outfit">
                {stats.masteredCount}
              </span>
              <p className="text-[11px] text-[#8e918f]">Thành thạo (Lvl 4)</p>
            </div>
          </div>

          {/* Multi-segment progress bar representing Mastery Levels */}
          <div className="space-y-1.5">
            <div className="h-3 w-full rounded-full bg-[#131314] overflow-hidden flex p-0.5 border border-[#3c4043]">
              {/* Level 4: Mastered Green */}
              <div
                style={{ width: `${(stats.levels.level4 / Math.max(1, stats.total)) * 100}%` }}
                className="h-full bg-[#34a853] rounded-full transition-all duration-500"
                title={`Level 4: ${stats.levels.level4} từ`}
              />
              {/* Level 3: Amber */}
              <div
                style={{ width: `${(stats.levels.level3 / Math.max(1, stats.total)) * 100}%` }}
                className="h-full bg-[#fbbc04] rounded-full transition-all duration-500"
                title={`Level 3: ${stats.levels.level3} từ`}
              />
              {/* Level 2: Light Blue */}
              <div
                style={{ width: `${(stats.levels.level2 / Math.max(1, stats.total)) * 100}%` }}
                className="h-full bg-[#a8c7fa] rounded-full transition-all duration-500"
                title={`Level 2: ${stats.levels.level2} từ`}
              />
              {/* Level 1: Purple */}
              <div
                style={{ width: `${(stats.levels.level1 / Math.max(1, stats.total)) * 100}%` }}
                className="h-full bg-[#c084fc] rounded-full transition-all duration-500"
                title={`Level 1: ${stats.levels.level1} từ`}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] sm:text-[11px] text-[#8e918f] font-mono px-0.5">
              <span>Đang học: {stats.learnedCount - stats.masteredCount}</span>
              <span>Trong kho: {stats.levels.level0} từ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Key Analytics 4-Grid Cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        {/* Metric 1: Due Today */}
        <div style={cardStyle} className="p-3.5 sm:p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium">Cần ôn hôm nay</span>
            <Clock className="h-4 w-4 text-[#ffe082]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#ffe082] font-outfit">
            {stats.dueTodayCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#8e918f]">
            {stats.dueTodayCount > 0 ? 'Đang chờ vào phiên học' : 'Đã hoàn thành ôn hôm nay'}
          </div>
        </div>

        {/* Metric 2: Mastered */}
        <div style={cardStyle} className="p-3.5 sm:p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium">Trí nhớ dài hạn</span>
            <Trophy className="h-4 w-4 text-[#34a853]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#c4eed0] font-outfit">
            {stats.masteredCount}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#8e918f]">
            Đạt mốc Level 4 ({stats.masteredPercent}% kho)
          </div>
        </div>

        {/* Metric 3: Retention Rate */}
        <div style={cardStyle} className="p-3.5 sm:p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium">Độ nhớ chuẩn</span>
            <Brain className="h-4 w-4 text-[#a8c7fa]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#a8c7fa] font-outfit">
            {stats.retentionRate}%
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#8e918f]">
            Từ nhớ tốt không mắc lỗi
          </div>
        </div>

        {/* Metric 4: Average Ease */}
        <div style={cardStyle} className="p-3.5 sm:p-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] sm:text-xs text-[#c4c7c5] font-medium">Hệ số SM-2 TB</span>
            <TrendingUp className="h-4 w-4 text-[#c084fc]" />
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-[#e8def8] font-outfit">
            {stats.avgEase}
          </div>
          <div className="text-[10px] sm:text-[11px] text-[#8e918f]">
            {Number(stats.avgEase) >= 2.5 ? 'Tốc độ tiếp thu rất tốt' : 'Cần ôn thêm phản xạ'}
          </div>
        </div>
      </div>

      {/* 3. Detailed 5-Level Memory Distribution */}
      <div style={cardStyle} className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-[#fbbc04]" />
            Phân bổ 5 cấp độ trí nhớ (SRS Levels)
          </div>
          <span className="text-xs text-[#8e918f]">SuperMemo-2</span>
        </div>

        <div className="space-y-2.5">
          {/* Level 4 */}
          <div
            onClick={() => setFilterMode('mastered')}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-[#282a2c]/60 hover:bg-[#282a2c] transition-colors cursor-pointer border border-[#3c4043]/50"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#34a853] shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-[#e3e3e3]">
                  Level 4 · Thành thạo (Master)
                </div>
                <div className="text-[10px] text-[#8e918f]">Nhớ 6+ lần · Giãn cách nhiều tháng</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[#c4eed0] font-mono">{stats.levels.level4}</span>
              <span className="text-[10px] text-[#8e918f] ml-1">từ</span>
            </div>
          </div>

          {/* Level 3 */}
          <div
            onClick={() => setFilterMode('learning')}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-[#282a2c]/60 hover:bg-[#282a2c] transition-colors cursor-pointer border border-[#3c4043]/50"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#fbbc04] shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-[#e3e3e3]">
                  Level 3 · Khắc sâu
                </div>
                <div className="text-[10px] text-[#8e918f]">Nhớ 4-5 lần · Trí nhớ trung hạn</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[#ffe082] font-mono">{stats.levels.level3}</span>
              <span className="text-[10px] text-[#8e918f] ml-1">từ</span>
            </div>
          </div>

          {/* Level 2 */}
          <div
            onClick={() => setFilterMode('learning')}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-[#282a2c]/60 hover:bg-[#282a2c] transition-colors cursor-pointer border border-[#3c4043]/50"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#a8c7fa] shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-[#e3e3e3]">
                  Level 2 · Đang nhớ
                </div>
                <div className="text-[10px] text-[#8e918f]">Nhớ 2-3 lần · Ôn lại sau 6 ngày</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[#a8c7fa] font-mono">{stats.levels.level2}</span>
              <span className="text-[10px] text-[#8e918f] ml-1">từ</span>
            </div>
          </div>

          {/* Level 1 */}
          <div
            onClick={() => setFilterMode('learning')}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-[#282a2c]/60 hover:bg-[#282a2c] transition-colors cursor-pointer border border-[#3c4043]/50"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#c084fc] shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-[#e3e3e3]">
                  Level 1 · Khởi đầu
                </div>
                <div className="text-[10px] text-[#8e918f]">Nhớ 1 lần · Ôn lại sau 1 ngày</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[#e8def8] font-mono">{stats.levels.level1}</span>
              <span className="text-[10px] text-[#8e918f] ml-1">từ</span>
            </div>
          </div>

          {/* Level 0 */}
          <div
            onClick={() => setFilterMode('unlearned')}
            className="flex items-center justify-between p-2.5 rounded-2xl bg-[#282a2c]/60 hover:bg-[#282a2c] transition-colors cursor-pointer border border-[#3c4043]/50"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8e918f] shrink-0" />
              <div>
                <div className="text-xs sm:text-sm font-semibold text-[#e3e3e3]">
                  Level 0 · Kho từ chưa học
                </div>
                <div className="text-[10px] text-[#8e918f]">Đang nằm trong kho Goethe A1</div>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-bold text-[#8e918f] font-mono">{stats.levels.level0}</span>
              <span className="text-[10px] text-[#8e918f] ml-1">từ</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Upcoming Review Forecast */}
      <div style={cardStyle} className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-[#a8c7fa]" />
            Dự báo lịch ôn tập sắp tới
          </div>
          <span className="text-xs text-[#c4c7c5]">7 ngày tới</span>
        </div>

        <div className="grid grid-cols-5 gap-1.5 text-center">
          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#282a2c]/70 border border-[#3c4043]">
            <div className="text-[10px] sm:text-xs text-[#ffe082] font-semibold">Hôm nay</div>
            <div className="text-base sm:text-lg font-bold text-white font-outfit mt-0.5">
              {stats.forecast.dueNow}
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#282a2c]/70 border border-[#3c4043]">
            <div className="text-[10px] sm:text-xs text-[#c4c7c5] font-medium">Mai</div>
            <div className="text-base sm:text-lg font-bold text-white font-outfit mt-0.5">
              {stats.forecast.tomorrow}
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#282a2c]/70 border border-[#3c4043]">
            <div className="text-[10px] sm:text-xs text-[#c4c7c5] font-medium">2-3 ngày</div>
            <div className="text-base sm:text-lg font-bold text-white font-outfit mt-0.5">
              {stats.forecast.next3Days}
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#282a2c]/70 border border-[#3c4043]">
            <div className="text-[10px] sm:text-xs text-[#c4c7c5] font-medium">4-7 ngày</div>
            <div className="text-base sm:text-lg font-bold text-white font-outfit mt-0.5">
              {stats.forecast.next7Days}
            </div>
          </div>

          <div className="p-2 sm:p-2.5 rounded-2xl bg-[#282a2c]/70 border border-[#3c4043]">
            <div className="text-[10px] sm:text-xs text-[#c4c7c5] font-medium">&gt; 7 ngày</div>
            <div className="text-base sm:text-lg font-bold text-white font-outfit mt-0.5">
              {stats.forecast.later}
            </div>
          </div>
        </div>
      </div>

      {/* 5. Most Mistaken Words (Need Attention) */}
      {stats.mostMistaken.length > 0 && (
        <div style={cardStyle} className="p-4 sm:p-5 space-y-3.5 border-[#8c1d18]/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-[#f2b8b5] tracking-tight font-outfit">
              <AlertTriangle className="h-4 w-4 sm:h-5 sm:w-5 text-[#f2b8b5]" />
              Từ vựng hay sai nhất (Cần chú ý ôn tập)
            </div>
            <span className="text-xs text-[#f2b8b5]/80 font-mono">
              Tổng {stats.totalMistakes} lỗi
            </span>
          </div>

          <div className="space-y-2">
            {stats.mostMistaken.map((word) => {
              const germanWord = word.german || word.french || ''
              return (
                <div
                  key={word.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#282a2c] border border-[#522525] hover:border-[#f2b8b5]/60 transition-colors"
                >
                  <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm sm:text-base font-bold text-white font-outfit">
                        {germanWord}
                      </span>
                      {word.ipa && (
                        <span className="text-[11px] font-mono text-[#a8c7fa]/90">{word.ipa}</span>
                      )}
                      <span
                        style={{ borderRadius: 9999 }}
                        className="text-[10px] font-bold px-2 py-0.5 bg-[#8c1d18]/40 text-[#f2b8b5] border border-[#f2b8b5]/30"
                      >
                        {word.mistakes} lần sai
                      </span>
                    </div>
                    <div className="text-xs text-[#c4c7c5] mt-0.5 truncate">{word.vietnamese}</div>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => handlePronounce(e, germanWord)}
                    style={{ borderRadius: 9999 }}
                    className="h-8 w-8 bg-[#1e1f20] hover:bg-[#333538] text-[#a8c7fa] flex items-center justify-center shrink-0 border border-[#444746] cursor-pointer"
                    title="Nghe phát âm"
                  >
                    <Volume2 className="h-4 w-4" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 6. Category Progress Breakdown */}
      <div style={cardStyle} className="p-4 sm:p-5 space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-[#c2e7ff]" />
            Tiến độ theo chủ đề Goethe A1
          </div>
          <span className="text-xs text-[#8e918f]">{stats.categoriesProgress.length} chủ đề</span>
        </div>

        <div className="space-y-2.5">
          {stats.categoriesProgress.map((cat) => (
            <div key={cat.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-[#e3e3e3] capitalize">{cat.name}</span>
                <span className="text-[#c4c7c5] font-mono text-[11px]">
                  {cat.learned}/{cat.total} từ ({cat.percent}%)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-[#131314] overflow-hidden p-0.5 border border-[#3c4043]/60">
                <div
                  style={{ width: `${cat.percent}%` }}
                  className="h-full bg-gradient-to-r from-[#1a73e8] to-[#34a853] rounded-full transition-all duration-300"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 7. Detailed Word Tracker & Search Drilldown (Từ nào đã học, mức độ nhớ) */}
      <div style={cardStyle} className="p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Target className="h-4 w-4 sm:h-5 sm:w-5 text-[#a8c7fa]" />
            Tra cứu chi tiết từ vựng & Mức độ nhớ
          </div>
          <span className="text-xs text-[#a8c7fa] font-mono font-semibold">
            {filteredWords.length} từ
          </span>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a8c7fa]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm từ đã học, nghĩa tiếng Việt..."
            className="pl-11 h-11 text-xs sm:text-sm bg-[#131314] border-[#444746]"
          />
        </div>

        {/* Category Pills if more than 1 category */}
        {categories.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
            <button
              onClick={() => setSelectedCategory('all')}
              style={{ borderRadius: 9999 }}
              className={`px-3 py-1 whitespace-nowrap font-medium transition-all cursor-pointer ${
                selectedCategory === 'all'
                  ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                  : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
              }`}
            >
              Tất cả chủ đề
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                style={{ borderRadius: 9999 }}
                className={`px-3 py-1 whitespace-nowrap font-medium transition-all cursor-pointer ${
                  selectedCategory === cat
                    ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                    : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setFilterMode('all-learned')}
            style={{ borderRadius: 9999 }}
            className={`px-3 py-1 font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterMode === 'all-learned'
                ? 'bg-[#004a77] text-[#c2e7ff] font-semibold'
                : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
            }`}
          >
            Đã học ({stats.learnedCount})
          </button>

          <button
            onClick={() => setFilterMode('mastered')}
            style={{ borderRadius: 9999 }}
            className={`px-3 py-1 font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterMode === 'mastered'
                ? 'bg-[#0f5223] text-[#c4eed0] font-semibold'
                : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
            }`}
          >
            Thành thạo ({stats.masteredCount})
          </button>

          <button
            onClick={() => setFilterMode('learning')}
            style={{ borderRadius: 9999 }}
            className={`px-3 py-1 font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterMode === 'learning'
                ? 'bg-[#394457] text-[#d3e3fd] font-semibold'
                : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
            }`}
          >
            Đang nhớ ({stats.learnedCount - stats.masteredCount})
          </button>

          <button
            onClick={() => setFilterMode('mistakes')}
            style={{ borderRadius: 9999 }}
            className={`px-3 py-1 font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterMode === 'mistakes'
                ? 'bg-[#8c1d18]/40 text-[#f2b8b5] border border-[#f2b8b5]/50 font-semibold'
                : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
            }`}
          >
            Có lỗi sai ({words.filter((w) => (w.mistakes ?? 0) > 0).length})
          </button>

          <button
            onClick={() => setFilterMode('unlearned')}
            style={{ borderRadius: 9999 }}
            className={`px-3 py-1 font-medium whitespace-nowrap transition-all cursor-pointer ${
              filterMode === 'unlearned'
                ? 'bg-[#333538] text-white font-semibold'
                : 'bg-[#131314] text-[#c4c7c5] hover:text-white border border-[#444746]/60'
            }`}
          >
            Kho từ chưa học ({stats.levels.level0})
          </button>
        </div>

        {/* Word Cards List with Memory Level Indicators */}
        <div className="space-y-2.5 max-h-[500px] overflow-y-auto pr-1">
          {filteredWords.length === 0 ? (
            <div className="text-center py-10 px-4 text-[#8e918f] text-xs sm:text-sm">
              Không tìm thấy từ vựng nào phù hợp trong bộ lọc này.
            </div>
          ) : (
            filteredWords.map((word) => {
              const rep = word.repetition ?? 0
              const mastery = getMasteryInfo(rep)
              const germanWord = word.german || word.french || ''
              const isDue = rep > 0 && word.dueDate <= today

              return (
                <div
                  key={word.id}
                  style={{ borderRadius: 18 }}
                  className="p-3 sm:p-3.5 bg-[#282a2c]/70 hover:bg-[#282a2c] border border-[#3c4043] transition-colors space-y-1.5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-white font-outfit">
                          {germanWord}
                        </span>
                        {word.ipa && (
                          <span className="text-[11px] font-mono text-[#a8c7fa]/90">{word.ipa}</span>
                        )}
                        <span
                          style={{ borderRadius: 9999 }}
                          className={`text-[9px] font-semibold px-2 py-0.5 border ${mastery.badgeClass}`}
                        >
                          {mastery.shortLabel}
                        </span>
                        {word.category && (
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 text-[#c4c7c5] border-[#444746]">
                            {word.category}
                          </Badge>
                        )}
                      </div>

                      <div className="text-xs sm:text-sm text-[#e3e3e3] font-medium mt-0.5">
                        {word.vietnamese}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handlePronounce(e, germanWord)}
                      style={{ borderRadius: 9999 }}
                      className="h-8 w-8 bg-[#1e1f20] hover:bg-[#333538] text-[#a8c7fa] flex items-center justify-center shrink-0 border border-[#444746] cursor-pointer"
                      title="Nghe phát âm"
                    >
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Word Memory & Review Schedule Meta */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#3c4043]/50 text-[10px] sm:text-[11px] text-[#8e918f]">
                    <div className="flex items-center gap-2">
                      <span>Lặp: <strong className="text-[#c4c7c5]">{rep}</strong></span>
                      <span>Cách: <strong className="text-[#c4c7c5]">{word.interval}d</strong></span>
                      {(word.mistakes ?? 0) > 0 && (
                        <span className="text-[#f2b8b5]">Lỗi: {word.mistakes}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      <span className={isDue ? 'text-[#ffe082] font-semibold' : ''}>
                        {rep === 0 ? 'Trong kho' : word.dueDate === today ? 'Hôm nay' : word.dueDate}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* CTA Button to Study */}
      {onSwitchToStudy && (
        <button
          onClick={onSwitchToStudy}
          style={{ borderRadius: 9999 }}
          className="w-full h-12 bg-gradient-to-r from-[#1a73e8] to-[#7c3aed] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-98 transition-all cursor-pointer"
        >
          <span>Vào phiên học từ vựng ngay</span>
          <ArrowUpRight className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default StatsView
