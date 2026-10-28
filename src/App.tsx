import { useState, useEffect, useCallback } from 'react'
import {
  BookOpen,
  Layers,
  Settings,
  Sparkles,
  Wifi,
  WifiOff,
  Flame,
  Package,
  Volume2
} from 'lucide-react'
import type { Word, DeckStats, StudyConfig } from '@/types'
import {
  initializeDefaultData,
  getStudySessionWords,
  getNewWordsFromPool,
  getAllWords,
  getDeckStats
} from '@/lib/db'
import { getStudyConfig } from '@/lib/srs'
import { playFeedback, unlockAudio } from '@/lib/audio'
import { speakGerman } from '@/lib/speech'
import { StudyView } from '@/components/study/StudyView'
import { VocabularyManager } from '@/components/manager/VocabularyManager'
import { SettingsView } from '@/components/settings/SettingsView'

export function App() {
  const [activeTab, setActiveTab] = useState<'study' | 'manager' | 'settings'>('study')
  const [isLoading, setIsLoading] = useState(true)

  // Configuration
  const [studyConfig] = useState<StudyConfig>(getStudyConfig())

  // Data
  const [sessionWords, setSessionWords] = useState<Word[]>([])
  const [allWords, setAllWords] = useState<Word[]>([])
  const [stats, setStats] = useState<DeckStats>({
    total: 0,
    dueToday: 0,
    newInPool: 0,
    mastered: 0,
    learning: 0,
    levelCounts: {
      level0: 0,
      level1: 0,
      level2: 0,
      level3: 0,
      level4: 0
    }
  })

  // Offline status
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  // Load / Refresh data from IndexedDB
  const refreshData = useCallback(async () => {
    try {
      await initializeDefaultData()
      const [session, all, deckStats] = await Promise.all([
        getStudySessionWords(studyConfig.newWordsPerBatch),
        getAllWords(),
        getDeckStats()
      ])
      setSessionWords(session.sessionWords)
      setAllWords(all)
      setStats(deckStats)
    } catch (err) {
      console.error('Failed to load database:', err)
    } finally {
      setIsLoading(false)
    }
  }, [studyConfig.newWordsPerBatch])

  // Load next batch of new words from the warehouse pool
  const handleLoadMoreNewWords = async (): Promise<Word[]> => {
    const moreWords = await getNewWordsFromPool(studyConfig.newWordsPerBatch)
    if (moreWords.length > 0) {
      setSessionWords(moreWords)
      playFeedback('success')
    }
    const deckStats = await getDeckStats()
    setStats(deckStats)
    return moreWords
  }

  useEffect(() => {
    let ignore = false

    // Unlock audio on initial mount as well
    unlockAudio()

    async function initialLoad() {
      try {
        await initializeDefaultData()
        const [session, all, deckStats] = await Promise.all([
          getStudySessionWords(studyConfig.newWordsPerBatch),
          getAllWords(),
          getDeckStats()
        ])
        if (!ignore) {
          setSessionWords(session.sessionWords)
          setAllWords(all)
          setStats(deckStats)
        }
      } catch (err) {
        console.error('Failed initial load:', err)
      } finally {
        if (!ignore) {
          setIsLoading(false)
        }
      }
    }

    initialLoad()

    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      ignore = true
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [studyConfig.newWordsPerBatch])

  const handleTabChange = (tab: 'study' | 'manager' | 'settings') => {
    unlockAudio()
    playFeedback('click')
    setActiveTab(tab)
  }

  return (
    <div className="min-h-[100dvh] w-full bg-[#131314] text-[#e3e3e3] flex flex-col justify-between selection:bg-[#a8c7fa] selection:text-[#041e49] overflow-x-hidden">
      {/* Material 3 Top App Bar (Optimized for iPhone 16 Dynamic Island & 393px width) */}
      <header className="sticky top-0 z-40 bg-[#131314]/95 backdrop-blur-xl border-b border-[#303336] px-3.5 sm:px-5 md:px-6 pt-[max(env(safe-area-inset-top),0.75rem)] pb-2.5">
        <div className="max-w-xl md:max-w-2xl mx-auto flex items-center justify-between gap-2">
          {/* Logo & Labs Title */}
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative h-9 w-9 shrink-0 rounded-2xl bg-gradient-to-tr from-[#1a73e8] via-[#7c3aed] to-[#d946ef] flex items-center justify-center shadow-md shadow-indigo-500/20 border border-white/15">
              <Sparkles className="h-4 w-4 text-white animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-sm sm:text-base font-bold tracking-tight text-white m-0 font-outfit truncate">
                  Ambitieux
                </h1>
                <span className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#282a2c] text-[#a8c7fa] border border-[#444746]/80 shrink-0">
                  Labs
                </span>
                <span className="text-[9px] sm:text-[10px] font-medium text-[#c4c7c5] px-1.5 py-0.5 rounded-full bg-[#1e1f20] border border-[#303336] shrink-0">
                  Goethe A1
                </span>
              </div>
              <div className="text-[10px] sm:text-[11px] text-[#c4c7c5] font-medium mt-0.5 flex items-center gap-1.5">
                {stats.dueToday > 0 ? (
                  <span className="text-[#ffe082] font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fbbc04] animate-ping" />
                    {stats.dueToday} từ cần ôn
                  </span>
                ) : (
                  <span className="text-[#c4eed0] font-semibold flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#34a853]" />
                    Đã ôn xong
                  </span>
                )}
                <span className="text-[#444746]">·</span>
                <span className="text-[#c4c7c5]">
                  {stats.newInPool} trong kho
                </span>
              </div>
            </div>
          </div>

          {/* Material 3 Status Assist Chips */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Quick Sound Test on Mobile Header */}
            <button
              type="button"
              onClick={() => {
                unlockAudio()
                playFeedback('click')
                speakGerman('Guten Tag', 1.0)
              }}
              style={{ borderRadius: 9999 }}
              className="flex items-center justify-center h-8 w-8 text-[#a8c7fa] bg-[#1e1f20] hover:bg-[#282a2c] active:scale-95 border border-[#444746] transition-all cursor-pointer"
              title="Chạm thử âm thanh tiếng Đức"
            >
              <Volume2 className="h-3.5 w-3.5" />
            </button>

            {/* Warehouse pool chip */}
            <div
              className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#1e1f20] border border-[#444746] text-[#c4c7c5] font-mono"
              title="Tổng số từ trong kho chưa học"
            >
              <Package className="h-3 w-3 text-[#a8c7fa]" />
              <span>{stats.newInPool}</span>
            </div>

            {/* Offline badge - visible on tablets/desktops or when offline */}
            <div
              className={`hidden sm:flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border ${
                isOnline
                  ? 'border-[#0f5223] bg-[#0f5223]/30 text-[#c4eed0]'
                  : 'border-[#444746] bg-[#1e1f20] text-[#c4c7c5]'
              }`}
              title={isOnline ? 'Online / PWA Offline Ready' : 'Chế độ Offline'}
            >
              {isOnline ? (
                <>
                  <Wifi className="h-3.5 w-3.5 text-[#34a853]" />
                  <span className="hidden md:inline">Offline OK</span>
                </>
              ) : (
                <>
                  <WifiOff className="h-3.5 w-3.5 text-[#fbbc04]" />
                  <span>Offline</span>
                </>
              )}
            </div>

            {/* Total cards badge */}
            <div className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full bg-[#1e1f20] border border-[#444746] text-[#c4c7c5] font-mono font-medium">
              <Flame className="h-3 w-3 text-[#ea4335]" />
              <span>{allWords.length}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content Area tailored for 393px width iPhone 16 */}
      <main className="flex-1 max-w-xl md:max-w-2xl w-full mx-auto px-3.5 sm:px-5 md:px-6 pt-4 sm:pt-6 pb-24 sm:pb-28 overflow-x-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <div className="h-9 w-9 rounded-full border-3 border-[#a8c7fa] border-t-transparent animate-spin" />
            <div className="text-xs sm:text-sm text-[#c4c7c5] font-medium">Đang chuẩn bị phiên học Ambitieux Goethe A1...</div>
          </div>
        ) : (
          <>
            {activeTab === 'study' && (
              <StudyView
                initialWords={sessionWords}
                allWords={allWords}
                onSessionComplete={refreshData}
                onLoadMoreNewWords={handleLoadMoreNewWords}
              />
            )}

            {activeTab === 'manager' && (
              <VocabularyManager
                words={allWords}
                onWordListChange={refreshData}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                words={allWords}
                onDataRefresh={refreshData}
              />
            )}
          </>
        )}
      </main>

      {/* Material 3 Bottom Navigation (Safe area bottom for iPhone 16 Home Indicator) */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-[#131314]/95 backdrop-blur-xl border-t border-[#303336] pb-[max(env(safe-area-inset-bottom),0.65rem)] pt-1.5 px-4 sm:px-6">
        <div className="max-w-md mx-auto flex items-center justify-around">
          {/* Tab 1: Học tập */}
          <button
            onClick={() => handleTabChange('study')}
            className="flex flex-col items-center gap-1 py-0.5 px-3 cursor-pointer group focus:outline-none"
          >
            <div
              style={{ borderRadius: 9999 }}
              className={`flex items-center justify-center h-8 w-14 sm:w-16 transition-all duration-200 ${
                activeTab === 'study'
                  ? 'bg-[#004a77] text-[#c2e7ff]'
                  : 'text-[#c4c7c5] group-hover:bg-[#282a2c]/60 group-hover:text-white'
              }`}
            >
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-medium transition-colors ${
                activeTab === 'study' ? 'text-[#c2e7ff] font-bold' : 'text-[#c4c7c5]'
              }`}
            >
              Học tập
            </span>
          </button>

          {/* Tab 2: Kho từ */}
          <button
            onClick={() => handleTabChange('manager')}
            className="flex flex-col items-center gap-1 py-0.5 px-3 cursor-pointer group focus:outline-none"
          >
            <div
              style={{ borderRadius: 9999 }}
              className={`flex items-center justify-center h-8 w-14 sm:w-16 transition-all duration-200 ${
                activeTab === 'manager'
                  ? 'bg-[#004a77] text-[#c2e7ff]'
                  : 'text-[#c4c7c5] group-hover:bg-[#282a2c]/60 group-hover:text-white'
              }`}
            >
              <Layers className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-medium transition-colors ${
                activeTab === 'manager' ? 'text-[#c2e7ff] font-bold' : 'text-[#c4c7c5]'
              }`}
            >
              Kho từ
            </span>
          </button>

          {/* Tab 3: Cài đặt */}
          <button
            onClick={() => handleTabChange('settings')}
            className="flex flex-col items-center gap-1 py-0.5 px-3 cursor-pointer group focus:outline-none"
          >
            <div
              style={{ borderRadius: 9999 }}
              className={`flex items-center justify-center h-8 w-14 sm:w-16 transition-all duration-200 ${
                activeTab === 'settings'
                  ? 'bg-[#004a77] text-[#c2e7ff]'
                  : 'text-[#c4c7c5] group-hover:bg-[#282a2c]/60 group-hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4 sm:h-5 sm:w-5" />
            </div>
            <span
              className={`text-[10px] sm:text-[11px] font-medium transition-colors ${
                activeTab === 'settings' ? 'text-[#c2e7ff] font-bold' : 'text-[#c4c7c5]'
              }`}
            >
              Cài đặt
            </span>
          </button>
        </div>
      </nav>
    </div>
  )
}

export default App
