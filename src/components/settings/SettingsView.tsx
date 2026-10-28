import React, { useState, useRef } from 'react'
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
  Sliders
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
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

interface SettingsViewProps {
  words: Word[]
  onDataRefresh: () => void
}

export function SettingsView({ words, onDataRefresh }: SettingsViewProps) {
  // Study configuration state
  const [studyConfig, setStudyConfig] = useState<StudyConfig>(getStudyConfig())

  // Import state
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false)
  const [pasteContent, setPasteContent] = useState('')
  const [importStatusMessage, setImportStatusMessage] = useState<string | null>(null)

  // Notification state
  const [hasNotifPermission, setHasNotifPermission] = useState(isNotificationGranted())
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(getReminderConfig())

  // Reset confirmation
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

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

      {/* Section 1: Nạp & Xuất dữ liệu */}
      <div style={cardStyle} className="p-4 sm:p-6 md:p-7 space-y-3.5 sm:space-y-4">
        <div className="flex items-center gap-2 text-sm sm:text-base font-bold text-white tracking-tight font-outfit">
          <Database className="h-4 w-4 sm:h-5 sm:w-5 text-[#a8c7fa]" />
          Dữ liệu & Đồng bộ (Anki / CSV)
        </div>

        <p className="text-xs sm:text-sm text-[#c4c7c5] leading-relaxed">
          Tương thích hoàn toàn với bộ thẻ Anki (.txt, .tsv) và bảng tính CSV (, hoặc ;). Toàn bộ dữ liệu được lưu trữ 100% nội bộ trên trình duyệt (IndexedDB) của bạn.
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:gap-3 pt-1">
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

      {/* Section 2: Phát âm tiếng Đức chuẩn tốc độ 1.0 */}
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
          <Volume2 className="h-4 w-4 mr-2 text-[#c084fc]" />
          Nghe thử phát âm tiếng Đức (Guten Tag !)
        </Button>
      </div>

      {/* Section 3: Nhắc nhở thông báo hàng ngày */}
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

      {/* Section 4: Quản trị kho từ (Khôi phục kho Goethe A1) */}
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
    </div>
  )
}

export default SettingsView
