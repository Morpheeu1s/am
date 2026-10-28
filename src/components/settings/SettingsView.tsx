import React, { useState, useRef, useEffect } from 'react'
import {
  Upload,
  Download,
  Bell,
  Volume2,
  Database,
  CheckCircle2,
  FileText,
  Trash2,
  Sparkles,
  Sliders,
  Cloud,
  CloudUpload,
  CloudDownload,
  Check,
  BookOpen,
  HelpCircle
} from 'lucide-react'
import type { Word, StudyConfig } from '@/types'
import {
  parseImportData,
  exportToAnkiTSV,
  exportToCSV,
  exportToJSON,
  downloadFile
} from '@/lib/parser'
import { bulkAddWords, resetDatabaseToDefault, clearAllWords } from '@/lib/db'
import {
  requestNotificationPermission,
  isNotificationGranted,
  sendNotification,
  getReminderConfig,
  saveReminderConfig,
  type ReminderConfig
} from '@/lib/notifications'
import { getStudyConfig, saveStudyConfig } from '@/lib/srs'
import { playFeedback, unlockAudio } from '@/lib/audio'
import { speakGerman, getTTSStatus } from '@/lib/speech'
import {
  getSupabaseCredentials,
  saveSupabaseCredentials,
  clearSupabaseCredentials,
  testSupabaseConnection,
  pushLocalToSupabase,
  pullSupabaseToLocal
} from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { DataFormatGuideModal } from '@/components/docs/DataFormatGuideModal'

interface SettingsViewProps {
  words: Word[]
  onDataRefresh: () => void
}

export function SettingsView({ words, onDataRefresh }: SettingsViewProps) {
  // Study configuration state
  const [studyConfig, setStudyConfig] = useState<StudyConfig>(getStudyConfig())

  // Import state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false)
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false)
  const [pasteContent, setPasteContent] = useState('')
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null)

  // Notification state
  const [hasNotifPermission, setHasNotifPermission] = useState(isNotificationGranted())
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(getReminderConfig())

  // Supabase state with lazy initializer
  const [supabaseUrl, setSupabaseUrl] = useState(() => getSupabaseCredentials().url)
  const [supabaseKey, setSupabaseKey] = useState(() => getSupabaseCredentials().key)
  const [supabaseStatus, setSupabaseStatus] = useState<{
    connected: boolean
    message: string
  }>({ connected: false, message: '' })
  const [isTestingSupabase, setIsTestingSupabase] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)

  // Reset confirmation
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Test Supabase connection on mount if credentials already exist
  useEffect(() => {
    const creds = getSupabaseCredentials()
    if (creds.url && creds.key) {
      testSupabaseConnection().then((res) => {
        setSupabaseStatus({ connected: res.success, message: res.message })
      })
    }
  }, [])

  const handleBatchSizeChange = (size: number) => {
    unlockAudio()
    playFeedback('click')
    const updated = { ...studyConfig, newWordsPerBatch: size }
    setStudyConfig(updated)
    saveStudyConfig(updated)
    onDataRefresh()
  }

  // Handle file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (event) => {
      const text = event.target?.result as string
      if (text) {
        await processImportText(text)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // Common import processor
  const processImportText = async (rawText: string) => {
    try {
      const parsedWords = parseImportData(rawText)
      if (parsedWords.length === 0) {
        alert('Không tìm thấy dữ liệu từ vựng hợp lệ. Vui lòng kiểm tra lại định dạng file hoặc văn bản.')
        return
      }

      const addedCount = await bulkAddWords(parsedWords)
      playFeedback('success')
      setImportStatusMessage(`Đã nạp thành công ${addedCount} từ vựng tiếng Đức mới vào kho!`)
      onDataRefresh()
      setTimeout(() => setImportStatusMessage(null), 4000)
    } catch {
      alert('Đã xảy ra lỗi khi nạp dữ liệu. Vui lòng thử lại.')
    }
  }

  const handlePasteImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pasteContent.trim()) return

    await processImportText(pasteContent)
    setIsPasteModalOpen(false)
    setPasteContent('')
  }

  // Export handlers
  const handleExportAnki = () => {
    playFeedback('click')
    const tsv = exportToAnkiTSV(words)
    downloadFile(tsv, `ambitieux-deutsch-anki-${Date.now()}.txt`, 'text/tab-separated-values;charset=utf-8')
  }

  const handleExportCSV = () => {
    playFeedback('click')
    const csv = exportToCSV(words)
    downloadFile(csv, `ambitieux-deutsch-${Date.now()}.csv`, 'text/csv;charset=utf-8')
  }

  const handleExportJSON = () => {
    playFeedback('click')
    const json = exportToJSON(words)
    downloadFile(json, `ambitieux-backup-${Date.now()}.json`, 'application/json;charset=utf-8')
  }

  // Notifications
  const handleRequestNotif = async () => {
    playFeedback('click')
    const res = await requestNotificationPermission()
    setHasNotifPermission(res === 'granted')
    if (res === 'granted') {
      sendNotification('Ambitieux - Thông báo kích hoạt', 'Bạn sẽ nhận được nhắc nhở ôn từ vựng tiếng Đức mỗi ngày!')
    }
  }

  const handleToggleReminder = (enabled: boolean) => {
    const updated = { ...reminderConfig, enabled }
    setReminderConfig(updated)
    saveReminderConfig(updated)
    playFeedback('click')
  }

  const handleTimeChange = (hour: number, minute: number) => {
    const updated = { ...reminderConfig, hour, minute }
    setReminderConfig(updated)
    saveReminderConfig(updated)
  }

  // Supabase Save & Test
  const handleSaveSupabase = async () => {
    playFeedback('click')
    saveSupabaseCredentials(supabaseUrl, supabaseKey)
    setIsTestingSupabase(true)
    const res = await testSupabaseConnection()
    setIsTestingSupabase(false)
    setSupabaseStatus({ connected: res.success, message: res.message })
    if (res.success) {
      playFeedback('success')
    } else {
      playFeedback('error')
    }
  }

  const handleDisconnectSupabase = () => {
    playFeedback('pop')
    clearSupabaseCredentials()
    setSupabaseUrl('')
    setSupabaseKey('')
    setSupabaseStatus({ connected: false, message: 'Đã hủy liên kết với Supabase' })
  }

  const handlePushToSupabase = async () => {
    if (!supabaseStatus.connected) {
      alert('Vui lòng lưu và kết nối thành công với Supabase trước khi đồng bộ.')
      return
    }
    setIsSyncing(true)
    playFeedback('click')
    const res = await pushLocalToSupabase()
    setIsSyncing(false)
    if (res.error) {
      alert(`Đồng bộ thất bại: ${res.error}`)
    } else {
      playFeedback('success')
      setImportStatusMessage(`Đã đồng bộ ${res.count} từ vựng lên Supabase Cloud!`)
      setTimeout(() => setImportStatusMessage(null), 4000)
    }
  }

  const handlePullFromSupabase = async () => {
    if (!supabaseStatus.connected) {
      alert('Vui lòng lưu và kết nối thành công với Supabase trước khi đồng bộ.')
      return
    }
    setIsSyncing(true)
    playFeedback('click')
    const res = await pullSupabaseToLocal()
    setIsSyncing(false)
    if (res.error) {
      alert(`Tải về thất bại: ${res.error}`)
    } else {
      playFeedback('success')
      onDataRefresh()
      setImportStatusMessage(`Đã cập nhật ${res.count} từ vựng từ Supabase về thiết bị!`)
      setTimeout(() => setImportStatusMessage(null), 4000)
    }
  }

  // Reset to default Goethe-Zertifikat A1 words
  const handleResetToDefault = async () => {
    unlockAudio()
    playFeedback('pop')
    await resetDatabaseToDefault()
    setIsResetConfirmOpen(false)
    onDataRefresh()
    setImportStatusMessage('Đã nạp lại kho từ vựng Goethe-Zertifikat A1 mặc định!')
    setTimeout(() => setImportStatusMessage(null), 3000)
  }

  // Clear all
  const handleClearAll = async () => {
    playFeedback('error')
    await clearAllWords()
    setIsClearConfirmOpen(false)
    onDataRefresh()
  }

  const cardStyle: React.CSSProperties = {
    borderRadius: 24,
    backgroundColor: '#1e1f20',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
  }

  return (
    <div className="w-full max-w-xl md:max-w-2xl mx-auto space-y-4 sm:space-y-5 pb-20">
      {/* Success Notification Alert Banner */}
      {importStatusMessage && (
        <div
          style={{ borderRadius: 20 }}
          className="flex items-center gap-2.5 p-3.5 sm:p-4 bg-[#0f5223]/30 border border-[#34a853]/60 text-[#c4eed0] text-xs sm:text-sm animate-in fade-in"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34a853]" />
          <span className="font-medium">{importStatusMessage}</span>
        </div>
      )}

      {/* Section 0: Cấu hình cơ chế học (Material 3 Card) */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
          <Sliders className="h-4 w-4 sm:h-5 sm:w-5 text-[#a8c7fa]" />
          Cơ chế học & Phân bổ kho từ Goethe A1
        </div>

        <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
          Toàn bộ từ vựng theo khung tham chiếu châu Âu chuẩn đề thi <strong>Goethe-Zertifikat A1: Start Deutsch 1</strong>. Mỗi phiên học sẽ ưu tiên ôn lại các từ cũ đến hạn, kèm theo một số lượng từ mới được bốc tự động từ kho.
        </p>

        <div className="flex items-center justify-between pt-1 sm:pt-2 gap-2 flex-wrap">
          <span className="text-xs sm:text-sm text-[#e3e3e3] font-medium">Số từ mới mỗi đợt:</span>
          {/* Material 3 Segmented Button */}
          <div
            style={{ borderRadius: 9999 }}
            className="flex gap-1 bg-[#131314] p-1 border border-[#303336]"
          >
            {[5, 10, 15, 20].map((size) => (
              <button
                key={size}
                onClick={() => handleBatchSizeChange(size)}
                style={{ borderRadius: 9999 }}
                className={`px-3 sm:px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  studyConfig.newWordsPerBatch === size
                    ? 'bg-[#004a77] text-[#c2e7ff] shadow-sm'
                    : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Section 1: Backend Supabase Cloud Sync */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4 border-[#34a853]/30">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Cloud className="h-4 w-4 sm:h-5 sm:w-5 text-[#34a853]" />
            Supabase Backend & Cloud Sync
          </div>
          <span
            style={{ borderRadius: 9999 }}
            className={`text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 border ${
              supabaseStatus.connected
                ? 'bg-[#0f5223]/60 text-[#c4eed0] border-[#34a853]'
                : 'bg-[#282a2c] text-[#8e918f] border-[#444746]'
            }`}
          >
            {supabaseStatus.connected ? '🟢 Đã kết nối Supabase' : '⚪ Chưa kết nối'}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
          Đồng bộ tiến độ học hai chiều giữa iPhone và Backend Supabase (PostgreSQL). Sẵn sàng mở rộng sang học ngữ pháp, bài tập tương tác và đăng nhập đa thiết bị.
        </p>

        {/* URL and Anon Key Inputs */}
        <div className="space-y-2.5 pt-1">
          <div>
            <label className="text-[11px] sm:text-xs font-medium text-[#c4c7c5] mb-1 block">
              Supabase Project URL
            </label>
            <Input
              value={supabaseUrl}
              onChange={(e) => setSupabaseUrl(e.target.value)}
              placeholder="https://xyzcompany.supabase.co"
              className="h-11 text-xs sm:text-sm font-mono bg-[#131314]"
            />
          </div>

          <div>
            <label className="text-[11px] sm:text-xs font-medium text-[#c4c7c5] mb-1 block">
              Supabase Public Anon Key
            </label>
            <Input
              type="password"
              value={supabaseKey}
              onChange={(e) => setSupabaseKey(e.target.value)}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
              className="h-11 text-xs sm:text-sm font-mono bg-[#131314]"
            />
          </div>

          {/* Connection Status feedback */}
          {supabaseStatus.message && (
            <div
              className={`text-xs p-2.5 rounded-xl border ${
                supabaseStatus.connected
                  ? 'bg-[#0f5223]/30 text-[#c4eed0] border-[#34a853]/50'
                  : 'bg-[#5c3e00]/30 text-[#ffe082] border-[#f29900]/50'
              }`}
            >
              {supabaseStatus.message}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 pt-1 flex-wrap">
            <Button
              variant="primary"
              size="md"
              disabled={isTestingSupabase}
              onClick={handleSaveSupabase}
              style={{ borderRadius: 9999 }}
              className="flex-1 text-xs sm:text-sm h-11 cursor-pointer"
            >
              <Check className="h-4 w-4 mr-1.5" />
              {isTestingSupabase ? 'Đang kiểm tra...' : 'Lưu & Kết nối'}
            </Button>

            {supabaseStatus.connected && (
              <Button
                variant="outline"
                size="md"
                onClick={handleDisconnectSupabase}
                style={{ borderRadius: 9999 }}
                className="text-xs sm:text-sm h-11 text-[#8e918f] cursor-pointer"
              >
                Hủy liên kết
              </Button>
            )}
          </div>

          {/* Cloud Sync Buttons */}
          {supabaseStatus.connected && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#3c4043]/60">
              <Button
                variant="tonal"
                size="md"
                disabled={isSyncing}
                onClick={handlePushToSupabase}
                style={{ borderRadius: 9999 }}
                className="w-full text-xs sm:text-sm h-11 cursor-pointer"
              >
                <CloudUpload className="h-4 w-4 mr-1.5 text-[#34a853]" />
                Đồng bộ lên Cloud
              </Button>

              <Button
                variant="tonal"
                size="md"
                disabled={isSyncing}
                onClick={handlePullFromSupabase}
                style={{ borderRadius: 9999 }}
                className="w-full text-xs sm:text-sm h-11 cursor-pointer"
              >
                <CloudDownload className="h-4 w-4 mr-1.5 text-[#a8c7fa]" />
                Tải từ Cloud về
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Section 2: Nạp & Xuất dữ liệu nội bộ */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Database className="h-4 w-4 sm:h-5 sm:w-5 text-[#a8c7fa]" />
            Dữ liệu & Đồng bộ (Anki / CSV / Supabase)
          </div>
          <button
            type="button"
            onClick={() => {
              playFeedback('click')
              setIsGuideModalOpen(true)
            }}
            className="text-xs text-[#a8c7fa] hover:text-[#c2e7ff] flex items-center gap-1 font-medium cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Xem chuẩn định dạng</span>
          </button>
        </div>

        <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
          Tương thích hoàn toàn với bộ thẻ Anki (.txt, .tsv), bảng tính CSV (, hoặc ;) và định dạng JSON / SQL Supabase.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 pt-1">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept=".txt,.tsv,.csv,.json"
            className="hidden"
          />

          <Button
            variant="tonal"
            size="md"
            onClick={() => fileInputRef.current?.click()}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs sm:text-sm cursor-pointer h-11 sm:h-12"
          >
            <Upload className="h-4 w-4 mr-1.5 text-[#a8c7fa]" />
            Nạp file Anki/CSV
          </Button>

          <Button
            variant="tonal"
            size="md"
            onClick={() => setIsPasteModalOpen(true)}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs sm:text-sm cursor-pointer h-11 sm:h-12"
          >
            <FileText className="h-4 w-4 mr-1.5 text-[#c4eed0]" />
            Dán bảng Text
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => {
              playFeedback('click')
              setIsGuideModalOpen(true)
            }}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs sm:text-sm cursor-pointer h-11 sm:h-12 border-[#a8c7fa]/40 text-[#a8c7fa] hover:bg-[#a8c7fa]/10"
          >
            <BookOpen className="h-4 w-4 mr-1.5" />
            Hướng dẫn format
          </Button>
        </div>

        {/* Export buttons */}
        <div className="pt-2.5 border-t border-[#3c4043]/60">
          <div className="text-xs text-[#8e918f] font-medium mb-2">Xuất dữ liệu dự phòng:</div>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAnki}
              style={{ borderRadius: 9999 }}
              className="text-xs py-1 h-9 sm:h-10 text-[#c4c7c5] hover:text-white cursor-pointer px-1"
            >
              <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">Anki TSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              style={{ borderRadius: 9999 }}
              className="text-xs py-1 h-9 sm:h-10 text-[#c4c7c5] hover:text-white cursor-pointer px-1"
            >
              <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">CSV</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              style={{ borderRadius: 9999 }}
              className="text-xs py-1 h-9 sm:h-10 text-[#c4c7c5] hover:text-white cursor-pointer px-1"
            >
              <Download className="h-3.5 w-3.5 mr-1 shrink-0" />
              <span className="truncate">JSON Full</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Section 3: Phát âm tiếng Đức chuẩn tốc độ 1.0 */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Volume2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#c084fc]" />
            Phát âm tiếng Đức (1.0 bản xứ)
          </div>
          <span
            style={{ borderRadius: 9999 }}
            className="text-[10px] sm:text-xs font-semibold px-2.5 py-0.5 sm:px-3 sm:py-1 bg-[#381e72]/60 text-[#e8def8] border border-[#4f378b] shrink-0"
          >
            {getTTSStatus().isNativeGermanVoice ? 'Bản xứ iOS (de-DE)' : 'Google German Audio'}
          </span>
        </div>

        <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
          Tự động tối ưu giọng đọc tiếng Đức bản xứ trên iPhone (Siri, Anna, Marlene, de-DE). Đã kích hoạt cơ chế gỡ chặn âm thanh iOS (Audio Autoplay Unlock).
        </p>

        <Button
          variant="tonal"
          size="md"
          onClick={() => {
            unlockAudio()
            playFeedback('click')
            speakGerman('Guten Tag! Herzlich willkommen bei Ambitieux Deutsch.', 1.0)
          }}
          style={{ borderRadius: 9999 }}
          className="w-full text-xs sm:text-sm font-semibold cursor-pointer h-11 sm:h-12"
        >
          <Volume2 className="h-4 w-4 mr-2 text-[#c084fc] text-[#c084fc]" />
          Nghe thử phát âm tiếng Đức (Guten Tag !)
        </Button>
      </div>

      {/* Section 4: Nhắc nhở thông báo hàng ngày */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
            <Bell className="h-4 w-4 sm:h-5 sm:w-5 text-[#fbbc04]" />
            Nhắc nhở ôn tập định kỳ
          </div>
          {hasNotifPermission && (
            <button
              onClick={() => handleToggleReminder(!reminderConfig.enabled)}
              style={{ borderRadius: 9999 }}
              className={`text-xs px-3.5 py-1 font-medium transition-colors cursor-pointer ${
                reminderConfig.enabled
                  ? 'bg-[#0f5223] text-[#c4eed0] border border-[#34a853]'
                  : 'bg-[#282a2c] text-[#8e918f] border border-[#444746]'
              }`}
            >
              {reminderConfig.enabled ? 'Đang bật' : 'Đang tắt'}
            </button>
          )}
        </div>

        {!hasNotifPermission ? (
          <div className="space-y-2.5">
            <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
              Cấp quyền thông báo để Ambitieux nhắc bạn vào ôn tập đúng khung giờ mỗi ngày, tránh quên từ vựng.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleRequestNotif}
              style={{ borderRadius: 9999 }}
              className="w-full text-xs sm:text-sm cursor-pointer h-11 sm:h-12"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              Kích hoạt thông báo trên iPhone / Trình duyệt
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
              Chọn khung giờ để nhận thông báo ôn từ vựng Goethe A1 hàng ngày:
            </p>
            <div className="flex items-center gap-2">
              <select
                value={reminderConfig.hour}
                onChange={(e) => handleTimeChange(Number(e.target.value), reminderConfig.minute)}
                className="bg-[#1e1f20] text-[#e3e3e3] border border-[#444746] rounded-full px-4 py-2 text-xs sm:text-sm focus:outline-none focus:border-[#a8c7fa]"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {i.toString().padStart(2, '0')}:00
                  </option>
                ))}
              </select>
              <span className="text-xs text-[#c4c7c5]">mỗi ngày</span>
            </div>
          </div>
        )}
      </div>

      {/* Section 5: Quản trị kho từ (Khôi phục kho Goethe A1) */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4 border-[#8c1d18]/40">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
          <Trash2 className="h-4 w-4 sm:h-5 sm:w-5 text-[#f2b8b5]" />
          Quản trị & Khôi phục kho từ
        </div>

        <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
          Khôi phục lại kho 474 từ vựng tiếng Đức chuẩn Goethe-Zertifikat A1 ban đầu hoặc xóa toàn bộ dữ liệu đang lưu trong IndexedDB.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
          <Button
            variant="outline"
            size="md"
            onClick={() => setIsResetConfirmOpen(true)}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs sm:text-sm text-[#a8c7fa] border-[#004a77] hover:bg-[#004a77]/30 cursor-pointer h-11 sm:h-12"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />
            Khôi phục kho A1
          </Button>

          <Button
            variant="destructive"
            size="md"
            onClick={() => setIsClearConfirmOpen(true)}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs sm:text-sm cursor-pointer h-11 sm:h-12"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Xóa toàn bộ từ
          </Button>
        </div>
      </div>

      {/* Modal: Paste Text Table */}
      <Modal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        title="Dán văn bản từ vựng (TSV / CSV)"
        description="Dán danh sách từ phân tách bằng Tab hoặc dấu phẩy"
      >
        <form onSubmit={handlePasteImportSubmit} className="space-y-4 mt-2">
          <div className="flex items-center justify-between text-xs text-[#8e918f]">
            <span>Hỗ trợ Tab (\t), dấu phẩy (,), chấm phẩy (;)</span>
            <button
              type="button"
              onClick={() => setIsGuideModalOpen(true)}
              className="text-[#a8c7fa] hover:underline flex items-center gap-1 cursor-pointer font-medium"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              Xem format mẫu
            </button>
          </div>
          <textarea
            rows={8}
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder={`Guten Tag\t[ɡuːtn̩ ˈtaːk]\txin chào\tgiao tiếp\tGuten Tag!\tChào bạn!\nder Tisch\t[tɪʃ]\tcái bàn\tnhà ở\tDer Tisch ist neu.\tCái bàn mới.`}
            style={{ borderRadius: 20 }}
            className="w-full bg-[#1e1f20] border border-[#444746] p-4 text-xs sm:text-sm font-mono text-[#e3e3e3] focus:outline-none focus:border-[#a8c7fa]"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPasteModalOpen(false)}
              style={{ borderRadius: 9999 }}
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              style={{ borderRadius: 9999 }}
            >
              Bắt đầu nạp dữ liệu
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Modal: Reset Default */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Khôi phục 474 từ Goethe A1?"
        description="Hành động này sẽ nạp lại toàn bộ kho 474 từ vựng chuẩn Goethe-Zertifikat A1 và đặt ngày ôn tập từ hôm nay."
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsResetConfirmOpen(false)}
            style={{ borderRadius: 9999 }}
          >
            Hủy
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleResetToDefault}
            style={{ borderRadius: 9999 }}
          >
            Đồng ý khôi phục
          </Button>
        </div>
      </Modal>

      {/* Confirmation Modal: Clear All */}
      <Modal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="Xóa toàn bộ dữ liệu?"
        description="Hành động này sẽ xóa sạch tất cả các từ vựng hiện tại trong IndexedDB của bạn. Thao tác không thể hoàn tác!"
      >
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsClearConfirmOpen(false)}
            style={{ borderRadius: 9999 }}
          >
            Hủy
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleClearAll}
            style={{ borderRadius: 9999 }}
          >
            Xác nhận xóa sạch
          </Button>
        </div>
      </Modal>

      {/* In-App Data Format Guide Modal */}
      <DataFormatGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />
    </div>
  )
}

export default SettingsView
