import React, { useState, useRef } from 'react'
import {
  Upload,
  Download,
  Bell,
  Volume2,
  Database,
  CheckCircle2,
  FileText,
  Smartphone,
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
import { playFeedback } from '@/lib/audio'
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
    borderRadius: 28,
    backgroundColor: '#1e1f20',
    border: '1px solid rgba(255, 255, 255, 0.08)',
    boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.4)'
  }

  return (
    <div className="w-full max-w-xl md:max-w-2xl mx-auto space-y-5 pb-20">
      {/* Success Notification Alert Banner */}
      {importStatusMessage && (
        <div
          style={{ borderRadius: 20 }}
          className="flex items-center gap-2.5 p-4 bg-[#0f5223]/30 border border-[#34a853]/60 text-[#c4eed0] text-xs md:text-sm animate-in fade-in"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34a853]" />
          <span className="font-medium">{importStatusMessage}</span>
        </div>
      )}

      {/* Section 0: Cấu hình cơ chế học (Material 3 Card) */}
      <div style={cardStyle} className="p-6 md:p-7 space-y-4">
        <div className="flex items-center gap-2.5 text-base font-bold text-white tracking-tight font-outfit">
          <Sliders className="h-5 w-5 text-[#a8c7fa]" />
          Cơ chế học & Phân bổ kho từ Goethe A1
        </div>

        <p className="text-xs md:text-sm text-[#c4c7c5] leading-relaxed">
          Toàn bộ từ vựng theo khung tham chiếu châu Âu chuẩn đề thi <strong>Goethe-Zertifikat A1: Start Deutsch 1</strong>. Mỗi phiên học sẽ ưu tiên ôn lại các từ cũ đến hạn, kèm theo một số lượng từ mới được bốc tự động từ kho.
        </p>

        <div className="flex items-center justify-between pt-2">
          <span className="text-xs md:text-sm text-[#e3e3e3] font-medium">Số từ mới mỗi đợt:</span>
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
                className={`px-3.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
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
      <div style={cardStyle} className="p-6 md:p-7 space-y-4">
        <div className="flex items-center gap-2.5 text-base font-bold text-white tracking-tight font-outfit">
          <Database className="h-5 w-5 text-[#a8c7fa]" />
          Dữ liệu & Đồng bộ (Anki / CSV)
        </div>

        <p className="text-xs md:text-sm text-[#c4c7c5] leading-relaxed">
          Tương thích hoàn toàn với bộ thẻ Anki (.txt, .tsv) và bảng tính CSV (, hoặc ;). Toàn bộ dữ liệu được lưu trữ 100% nội bộ trên trình duyệt (IndexedDB) của bạn.
        </p>

        <div className="grid grid-cols-2 gap-3 pt-1">
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
            className="w-full text-xs md:text-sm cursor-pointer h-12"
          >
            <Upload className="h-4 w-4 mr-1.5 text-[#a8c7fa]" />
            Nạp file Anki/CSV
          </Button>

          <Button
            variant="tonal"
            size="md"
            onClick={() => setIsPasteModalOpen(true)}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs md:text-sm cursor-pointer h-12"
          >
            <FileText className="h-4 w-4 mr-1.5 text-[#c4eed0]" />
            Dán bảng Text
          </Button>
        </div>

        {/* Export buttons */}
        <div className="pt-3 border-t border-[#3c4043]/60">
          <div className="text-xs text-[#8e918f] font-medium mb-2.5">Xuất dữ liệu dự phòng:</div>
          <div className="grid grid-cols-3 gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAnki}
              style={{ borderRadius: 9999 }}
              className="text-xs py-1 h-10 text-[#c4c7c5] hover:text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Anki TSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCSV}
              style={{ borderRadius: 9999 }}
              className="text-xs py-1 h-10 text-[#c4c7c5] hover:text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportJSON}
              style={{ borderRadius: 9999 }}
              className="text-xs py-1 h-10 text-[#c4c7c5] hover:text-white cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              JSON Full
            </Button>
          </div>
        </div>
      </div>

      {/* Section 2: Phát âm tiếng Đức chuẩn tốc độ 1.0 */}
      <div style={cardStyle} className="p-6 md:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-base font-bold text-white tracking-tight font-outfit">
            <Volume2 className="h-5 w-5 text-[#c084fc]" />
            Phát âm tiếng Đức (Tốc độ 1.0 bản xứ)
          </div>
          <span
            style={{ borderRadius: 9999 }}
            className="text-[10px] md:text-xs font-semibold px-3 py-1 bg-[#381e72]/60 text-[#e8def8] border border-[#4f378b]"
          >
            {getTTSStatus().isNativeGermanVoice ? 'Bản xứ OS (de-DE)' : 'Google German Audio'}
          </span>
        </div>

        <p className="text-xs md:text-sm text-[#c4c7c5] leading-relaxed">
          Tự động nhận diện giọng tiếng Đức bản xứ của máy (Siri, Anna, Marlene, Hedda, de-DE). Nếu thiết bị chưa có gói giọng Đức, hệ thống tự động phát âm thanh tiếng Đức bản xứ chuẩn, tuyệt đối không dùng giọng tiếng Anh.
        </p>

        <Button
          variant="tonal"
          size="md"
          onClick={() => {
            playFeedback('click')
            speakGerman('Guten Tag! Herzlich willkommen bei Ambitieux Deutsch.', 1.0)
          }}
          style={{ borderRadius: 9999 }}
          className="w-full text-xs md:text-sm font-semibold cursor-pointer h-12"
        >
          <Volume2 className="h-4 w-4 mr-2 text-[#c084fc]" />
          Nghe thử phát âm tiếng Đức chuẩn (Guten Tag !)
        </Button>
      </div>

      {/* Section 3: Nhắc nhở thông báo hàng ngày */}
      <div style={cardStyle} className="p-6 md:p-7 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 text-base font-bold text-white tracking-tight font-outfit">
            <Bell className="h-5 w-5 text-[#fbbc04]" />
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
          <div className="space-y-3">
            <p className="text-xs md:text-sm text-[#c4c7c5] leading-relaxed">
              Cấp quyền thông báo để Ambitieux nhắc bạn vào ôn tập đúng khung giờ mỗi ngày, tránh quên từ vựng.
            </p>
            <Button
              variant="primary"
              size="md"
              onClick={handleRequestNotif}
              style={{ borderRadius: 9999 }}
              className="w-full text-xs md:text-sm cursor-pointer h-12"
            >
              <Bell className="h-4 w-4 mr-1.5" />
              Cho phép gửi thông báo
            </Button>
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs md:text-sm text-[#e3e3e3] font-medium">Khung giờ nhắc học</span>
              <div className="flex items-center gap-1.5">
                <select
                  value={reminderConfig.hour}
                  onChange={(e) => handleTimeChange(Number(e.target.value), reminderConfig.minute)}
                  style={{ borderRadius: 12 }}
                  className="border border-[#444746] bg-[#282a2c] px-3 py-1.5 text-xs text-white"
                >
                  {Array.from({ length: 24 }).map((_, i) => (
                    <option key={i} value={i}>
                      {String(i).padStart(2, '0')}h
                    </option>
                  ))}
                </select>
                <span className="text-[#8e918f] font-bold">:</span>
                <select
                  value={reminderConfig.minute}
                  onChange={(e) => handleTimeChange(reminderConfig.hour, Number(e.target.value))}
                  style={{ borderRadius: 12 }}
                  className="border border-[#444746] bg-[#282a2c] px-3 py-1.5 text-xs text-white"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m}>
                      {String(m).padStart(2, '0')}m
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                playFeedback('click')
                sendNotification('Ambitieux - Zeit für Deutsch !', 'Đã đến giờ ôn tập 10 phút tiếng Đức Goethe A1 hôm nay!')
              }}
              style={{ borderRadius: 9999 }}
              className="w-full text-xs text-[#c4c7c5] hover:text-white cursor-pointer h-10"
            >
              Thử nghiệm thông báo ngay
            </Button>
          </div>
        )}
      </div>

      {/* Section 4: Hướng dẫn cài đặt PWA trên iPhone Safari */}
      <div style={cardStyle} className="p-6 md:p-7 space-y-4">
        <div className="flex items-center gap-2.5 text-base font-bold text-white tracking-tight font-outfit">
          <Smartphone className="h-5 w-5 text-[#34a853]" />
          Chạy Offline 100% trên iPhone (PWA)
        </div>
        <p className="text-xs md:text-sm text-[#c4c7c5] leading-relaxed">
          Để sử dụng toàn màn hình không có thanh địa chỉ Safari và chạy mượt mà ngay cả khi ngắt mạng:
        </p>
        <ol
          style={{ borderRadius: 20 }}
          className="text-xs md:text-sm text-[#e3e3e3] space-y-2 list-decimal list-inside bg-[#282a2c]/60 p-4 border border-[#3c4043]/80 leading-relaxed"
        >
          <li>Mở ứng dụng trong trình duyệt <strong>Safari iOS</strong>.</li>
          <li>Chạm vào biểu tượng <strong>Chia sẻ (Share)</strong> ở thanh dưới cùng.</li>
          <li>Cuộn xuống và chọn <strong>\"Thêm vào MH chính\" (Add to Home Screen)</strong>.</li>
          <li>Mở icon <strong>Ambitieux</strong> trên màn hình chính iPhone để trải nghiệm mượt mà không viền.</li>
        </ol>
      </div>

      {/* Section 5: Quản trị & Khôi phục Seed Data */}
      <div style={cardStyle} className="p-6 md:p-7 space-y-4">
        <div className="text-base font-bold text-white tracking-tight font-outfit">
          Quản trị kho từ vựng Goethe A1
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="tonal"
            size="md"
            onClick={() => setIsResetConfirmOpen(true)}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs md:text-sm text-[#c4c7c5] hover:text-white cursor-pointer h-12"
          >
            <Sparkles className="h-4 w-4 mr-1.5 text-[#a8c7fa]" />
            Nạp lại kho từ Goethe A1
          </Button>

          <Button
            variant="outline"
            size="md"
            onClick={() => setIsClearConfirmOpen(true)}
            style={{ borderRadius: 9999 }}
            className="w-full text-xs md:text-sm text-[#f2b8b5] hover:text-white border-[#8c1d18] hover:bg-[#8c1d18]/20 cursor-pointer h-12"
          >
            <Trash2 className="h-4 w-4 mr-1.5" />
            Xóa hết dữ liệu
          </Button>
        </div>
      </div>

      {/* Modal Paste Import */}
      <Modal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        title="Dán dữ liệu từ vựng tiếng Đức"
        description="Dán văn bản phân tách bằng Tab hoặc Dấu phẩy (German | IPA | Nghĩa | Chủ đề | Ví dụ)"
      >
        <form onSubmit={handlePasteImportSubmit} className="space-y-4 mt-2">
          <textarea
            required
            rows={8}
            value={pasteContent}
            onChange={(e) => setPasteContent(e.target.value)}
            placeholder={`hallo\t[ˈhalo]\txin chào\tgiao tiếp\tHallo, wie geht es dir?\ndanke\t[ˈdaŋkə]\tcảm ơn\tgiao tiếp\tDanke für deine Hilfe!`}
            style={{ borderRadius: 20 }}
            className="w-full border border-[#444746] bg-[#1e1f20] p-4 text-xs font-mono text-[#e3e3e3] focus:outline-none focus:ring-2 focus:ring-[#a8c7fa]/30"
          />

          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsPasteModalOpen(false)}
              style={{ borderRadius: 9999 }}
              className="flex-1 cursor-pointer h-12"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              style={{ borderRadius: 9999 }}
              className="flex-1 font-semibold cursor-pointer h-12"
            >
              Bắt đầu nạp
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal Confirm Reset to Goethe A1 */}
      <Modal
        isOpen={isResetConfirmOpen}
        onClose={() => setIsResetConfirmOpen(false)}
        title="Khôi phục kho từ Goethe-Zertifikat A1?"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#c4c7c5]">
            Hành động này sẽ khôi phục kho về bộ từ vựng <strong className="text-white">Goethe-Zertifikat A1: Start Deutsch 1</strong> chuẩn từ file <code className="text-[#a8c7fa]">vocab_goethe_a1.json</code>.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsResetConfirmOpen(false)}
              style={{ borderRadius: 9999 }}
              className="flex-1 cursor-pointer h-12"
            >
              Hủy
            </Button>
            <Button
              type="submit"
              variant="primary"
              onClick={handleResetToDefault}
              style={{ borderRadius: 9999 }}
              className="flex-1 font-semibold cursor-pointer h-12"
            >
              Xác nhận nạp lại
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Confirm Clear All */}
      <Modal
        isOpen={isClearConfirmOpen}
        onClose={() => setIsClearConfirmOpen(false)}
        title="Xóa toàn bộ kho từ vựng?"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#c4c7c5]">
            Cảnh báo: Toàn bộ từ vựng và lịch sử ôn tập trong IndexedDB sẽ bị xóa sạch hoàn toàn.
          </p>
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsClearConfirmOpen(false)}
              style={{ borderRadius: 9999 }}
              className="flex-1 cursor-pointer h-12"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleClearAll}
              style={{ borderRadius: 9999 }}
              className="flex-1 font-semibold cursor-pointer h-12"
            >
              Xóa sạch
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
