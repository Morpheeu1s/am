import React, { useState } from 'react'
import {
  Search,
  Plus,
  Volume2,
  Trash2,
  Edit2,
  Calendar,
  Layers
} from 'lucide-react'
import type { Word } from '@/types'
import { addWord, updateWord, deleteWord } from '@/lib/db'
import { speakGerman } from '@/lib/speech'
import { playFeedback } from '@/lib/audio'
import { getTodayDateString, getMasteryInfo } from '@/lib/srs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Modal } from '@/components/ui/modal'

interface VocabularyManagerProps {
  words: Word[]
  onWordListChange: () => void
}

const GERMAN_UMLAUTS = ['ä', 'ö', 'ü', 'ß', 'Ä', 'Ö', 'Ü']

type LevelFilter = 'all' | 'due' | 'lvl0' | 'lvl1' | 'lvl2' | 'lvl3' | 'lvl4'

export function VocabularyManager({ words, onWordListChange }: VocabularyManagerProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedFilter, setSelectedFilter] = useState<LevelFilter>('all')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [editingWord, setEditingWord] = useState<Word | null>(null)
  const [deleteConfirmWord, setDeleteConfirmWord] = useState<Word | null>(null)

  // Form State for Add / Edit
  const [formGerman, setFormGerman] = useState('')
  const [formIpa, setFormIpa] = useState('')
  const [formVietnamese, setFormVietnamese] = useState('')
  const [formCategory, setFormCategory] = useState('giao tiếp')
  const [formExample, setFormExample] = useState('')
  const [formExampleVi, setFormExampleVi] = useState('')

  const today = getTodayDateString()

  // Distinct categories
  const categories = Array.from(new Set(words.map((w) => w.category || 'chung'))).sort()

  // Filter words
  const filteredWords = words.filter((w) => {
    const germanText = w.german || w.french || ''
    const matchesSearch =
      germanText.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.vietnamese.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (w.example && w.example.toLowerCase().includes(searchTerm.toLowerCase()))

    if (!matchesSearch) return false

    if (selectedCategory !== 'all' && (w.category || 'chung') !== selectedCategory) {
      return false
    }

    const rep = w.repetition ?? 0
    if (selectedFilter === 'due') {
      return rep > 0 && w.dueDate <= today
    }
    if (selectedFilter === 'lvl0') {
      return rep === 0
    }
    if (selectedFilter === 'lvl1') {
      return rep === 1
    }
    if (selectedFilter === 'lvl2') {
      return rep >= 2 && rep <= 3
    }
    if (selectedFilter === 'lvl3') {
      return rep >= 4 && rep <= 5
    }
    if (selectedFilter === 'lvl4') {
      return rep >= 6
    }
    return true
  })

  const resetForm = () => {
    setFormGerman('')
    setFormIpa('')
    setFormVietnamese('')
    setFormCategory('giao tiếp')
    setFormExample('')
    setFormExampleVi('')
  }

  const handleOpenAddModal = () => {
    resetForm()
    setIsAddModalOpen(true)
  }

  const handleOpenEditModal = (word: Word) => {
    setEditingWord(word)
    setFormGerman(word.german || word.french || '')
    setFormIpa(word.ipa || '')
    setFormVietnamese(word.vietnamese)
    setFormCategory(word.category || 'giao tiếp')
    setFormExample(word.example || '')
    setFormExampleVi(word.exampleVi || '')
  }

  const handleInsertFormAccent = (char: string) => {
    playFeedback('click')
    setFormGerman((prev) => prev + char)
  }

  const handleSaveAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formGerman.trim() || !formVietnamese.trim()) return

    playFeedback('success')
    let formattedIpa = formIpa.trim()
    if (formattedIpa && !formattedIpa.startsWith('[') && !formattedIpa.startsWith('/')) {
      formattedIpa = `[${formattedIpa}]`
    }

    await addWord({
      german: formGerman.trim(),
      french: formGerman.trim(),
      ipa: formattedIpa,
      vietnamese: formVietnamese.trim(),
      category: formCategory.trim() || 'giao tiếp',
      example: formExample.trim(),
      exampleVi: formExampleVi.trim(),
      repetition: 0,
      interval: 0,
      easeFactor: 2.5,
      dueDate: today,
      mistakes: 0
    })

    setIsAddModalOpen(false)
    resetForm()
    onWordListChange()
  }

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingWord || !editingWord.id || !formGerman.trim() || !formVietnamese.trim()) return

    playFeedback('success')
    let formattedIpa = formIpa.trim()
    if (formattedIpa && !formattedIpa.startsWith('[') && !formattedIpa.startsWith('/')) {
      formattedIpa = `[${formattedIpa}]`
    }

    await updateWord(editingWord.id, {
      german: formGerman.trim(),
      french: formGerman.trim(),
      ipa: formattedIpa,
      vietnamese: formVietnamese.trim(),
      category: formCategory.trim() || 'giao tiếp',
      example: formExample.trim(),
      exampleVi: formExampleVi.trim()
    })

    setEditingWord(null)
    resetForm()
    onWordListChange()
  }

  const handleDelete = async () => {
    if (!deleteConfirmWord || !deleteConfirmWord.id) return

    playFeedback('error')
    await deleteWord(deleteConfirmWord.id)
    setDeleteConfirmWord(null)
    onWordListChange()
  }

  // Count words by level
  const counts = {
    all: words.length,
    due: words.filter((w) => (w.repetition ?? 0) > 0 && w.dueDate <= today).length,
    lvl0: words.filter((w) => (w.repetition ?? 0) === 0).length,
    lvl1: words.filter((w) => w.repetition === 1).length,
    lvl2: words.filter((w) => (w.repetition ?? 0) >= 2 && (w.repetition ?? 0) <= 3).length,
    lvl3: words.filter((w) => (w.repetition ?? 0) >= 4 && (w.repetition ?? 0) <= 5).length,
    lvl4: words.filter((w) => (w.repetition ?? 0) >= 6).length
  }

  return (
    <div className="w-full max-w-xl md:max-w-2xl mx-auto space-y-4 pb-16">
      {/* Material 3 Search Bar & Extended Action Button */}
      <div className="flex items-center gap-2.5">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-[#a8c7fa]" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm từ tiếng Đức, nghĩa tiếng Việt, ví dụ..."
            className="pl-11 h-12 text-sm bg-[#1e1f20] border-[#444746] focus-visible:border-[#a8c7fa]"
          />
        </div>
        <Button
          variant="primary"
          size="md"
          onClick={handleOpenAddModal}
          style={{ borderRadius: 9999 }}
          className="h-12 px-5 shrink-0 shadow-md shadow-blue-500/20 cursor-pointer"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Thêm từ
        </Button>
      </div>

      {/* Material 3 Filter Chips (Level Tabs) */}
      <div
        style={{ borderRadius: 9999 }}
        className="flex items-center gap-1.5 p-1 bg-[#1e1f20] border border-[#303336] text-xs overflow-x-auto scrollbar-none"
      >
        <button
          onClick={() => setSelectedFilter('all')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'all'
              ? 'bg-[#004a77] text-[#c2e7ff] font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Tất cả ({counts.all})
        </button>
        <button
          onClick={() => setSelectedFilter('due')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'due'
              ? 'bg-[#5c3e00] text-[#ffe082] font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Cần ôn ({counts.due})
        </button>
        <button
          onClick={() => setSelectedFilter('lvl0')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'lvl0'
              ? 'bg-[#333538] text-white font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Lvl 0 Kho Goethe ({counts.lvl0})
        </button>
        <button
          onClick={() => setSelectedFilter('lvl1')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'lvl1'
              ? 'bg-[#004a77] text-[#c2e7ff] font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Lvl 1 ({counts.lvl1})
        </button>
        <button
          onClick={() => setSelectedFilter('lvl2')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'lvl2'
              ? 'bg-[#394457] text-[#d3e3fd] font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Lvl 2 ({counts.lvl2})
        </button>
        <button
          onClick={() => setSelectedFilter('lvl3')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'lvl3'
              ? 'bg-[#5c3e00] text-[#ffe082] font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Lvl 3 ({counts.lvl3})
        </button>
        <button
          onClick={() => setSelectedFilter('lvl4')}
          style={{ borderRadius: 9999 }}
          className={`py-1.5 px-3.5 font-medium whitespace-nowrap transition-all cursor-pointer ${
            selectedFilter === 'lvl4'
              ? 'bg-[#0f5223] text-[#c4eed0] font-semibold shadow-sm'
              : 'text-[#c4c7c5] hover:text-white hover:bg-[#282a2c]'
          }`}
        >
          Lvl 4 Master ({counts.lvl4})
        </button>
      </div>

      {/* Category selector Assist Chips */}
      {categories.length > 1 && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
          <button
            onClick={() => setSelectedCategory('all')}
            style={{ borderRadius: 9999 }}
            className={`px-3.5 py-1 whitespace-nowrap font-medium transition-all border cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-[#004a77]/50 text-[#c2e7ff] border-[#004a77]'
                : 'bg-[#1e1f20] text-[#c4c7c5] border-[#444746]/60 hover:text-white hover:bg-[#282a2c]'
            }`}
          >
            Tất cả chủ đề
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{ borderRadius: 9999 }}
              className={`px-3.5 py-1 whitespace-nowrap font-medium transition-all border cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-[#004a77]/50 text-[#c2e7ff] border-[#004a77]'
                  : 'bg-[#1e1f20] text-[#c4c7c5] border-[#444746]/60 hover:text-white hover:bg-[#282a2c]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Word Cards List (Material 3 Cards) */}
      <div className="space-y-3">
        {filteredWords.length === 0 ? (
          <div
            style={{
              borderRadius: 28,
              backgroundColor: '#1e1f20',
              border: '1px dashed #444746'
            }}
            className="text-center py-12 px-4"
          >
            <Layers className="h-10 w-10 text-[#8e918f] mx-auto mb-2" />
            <div className="text-sm font-semibold text-[#e3e3e3]">Không tìm thấy từ vựng</div>
            <div className="text-xs text-[#8e918f] mt-1">
              {searchTerm ? 'Thử tìm với từ khóa khác' : 'Chưa có từ vựng nào trong mục này'}
            </div>
          </div>
        ) : (
          filteredWords.map((word) => {
            const mastery = getMasteryInfo(word.repetition ?? 0)
            const germanWord = word.german || word.french || ''
            return (
              <div
                key={word.id}
                style={{
                  borderRadius: 24,
                  backgroundColor: '#1e1f20',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  boxShadow: '0 2px 12px -2px rgba(0, 0, 0, 0.3)'
                }}
                className="p-4 md:p-5 transition-all hover:border-[#a8c7fa]/60 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-lg md:text-xl font-bold text-white tracking-tight font-outfit">
                        {germanWord}
                      </span>
                      <button
                        onClick={() => speakGerman(germanWord, 1.0)}
                        style={{ borderRadius: 9999 }}
                        className="h-8 w-8 bg-[#004a77]/30 text-[#a8c7fa] hover:bg-[#004a77]/60 flex items-center justify-center transition-colors cursor-pointer"
                        title="Phát âm tiếng Đức chuẩn"
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                      <span
                        style={{ borderRadius: 9999 }}
                        className={`text-[10px] font-semibold px-2.5 py-0.5 border ${mastery.badgeClass}`}
                      >
                        {mastery.shortLabel}
                      </span>
                      {word.category && (
                        <Badge variant="outline" className="text-[10px] py-0 px-2 text-[#c4c7c5] border-[#444746]">
                          {word.category}
                        </Badge>
                      )}
                    </div>

                    {word.ipa && (
                      <div className="text-xs font-mono text-[#a8c7fa]/90 mt-0.5">
                        {word.ipa}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEditModal(word)}
                      style={{ borderRadius: 9999 }}
                      className="h-8 w-8 bg-[#282a2c] hover:bg-[#333538] text-[#c4c7c5] hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                      title="Chỉnh sửa"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirmWord(word)}
                      style={{ borderRadius: 9999 }}
                      className="h-8 w-8 bg-[#282a2c] hover:bg-[#8c1d18]/40 text-[#c4c7c5] hover:text-[#f2b8b5] flex items-center justify-center transition-colors cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Vietnamese Meaning */}
                <div className="text-sm md:text-base text-[#e3e3e3] font-medium">
                  {word.vietnamese}
                </div>

                {/* Example if present */}
                {word.example && (
                  <div
                    style={{ borderRadius: 18 }}
                    className="text-xs md:text-sm text-[#c4c7c5] italic bg-[#282a2c]/60 p-3.5 border border-[#3c4043]/70"
                  >
                    <div className="flex items-center justify-between text-[#e3e3e3]">
                      <span>\"{word.example}\"</span>
                      <button
                        onClick={() => speakGerman(word.example || '', 1.0)}
                        className="text-[#a8c7fa] hover:text-[#c2e7ff] p-1 cursor-pointer"
                        title="Nghe câu tiếng Đức"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {word.exampleVi && (
                      <div className="text-[#8e918f] not-italic mt-1 text-xs">{word.exampleVi}</div>
                    )}
                  </div>
                )}

                {/* SRS Meta Footer */}
                <div className="flex items-center justify-between pt-2 border-t border-[#3c4043]/60 text-xs text-[#8e918f]">
                  <div className="flex items-center gap-3">
                    <span>Lặp: <strong className="text-[#c4c7c5]">{word.repetition}</strong></span>
                    <span>Cách: <strong className="text-[#c4c7c5]">{word.interval}d</strong></span>
                    <span>Độ khó: <strong className="text-[#c4c7c5]">{word.easeFactor}</strong></span>
                  </div>
                  <div className="flex items-center gap-1 font-medium">
                    <Calendar className="h-3.5 w-3.5" />
                    <span className={(word.repetition ?? 0) > 0 && word.dueDate <= today ? 'text-[#ffe082] font-semibold' : ''}>
                      {(word.repetition ?? 0) === 0 ? 'Trong kho' : word.dueDate === today ? 'Hôm nay' : word.dueDate}
                    </span>
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal: Add New Word (Material 3 Dialog) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Thêm từ vựng tiếng Đức Goethe A1"
        description="Điền thông tin từ vựng tiếng Đức để đưa vào kho từ SM-2"
      >
        <form onSubmit={handleSaveAdd} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Từ / Cụm từ tiếng Đức *
            </label>
            <div className="flex gap-2">
              <Input
                required
                value={formGerman}
                onChange={(e) => setFormGerman(e.target.value)}
                placeholder="Ví dụ: Guten Tag, der Tisch..."
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => formGerman && speakGerman(formGerman, 1.0)}
                style={{ borderRadius: 9999 }}
                className="shrink-0 h-13 w-13 cursor-pointer"
                title="Nghe thử"
              >
                <Volume2 className="h-5 w-5 text-[#a8c7fa]" />
              </Button>
            </div>
            {/* Quick Umlaut Toolbar */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {GERMAN_UMLAUTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleInsertFormAccent(c)}
                  style={{ borderRadius: 12 }}
                  className="h-8 w-8 bg-[#1e1f20] hover:bg-[#333538] text-xs font-semibold text-[#e3e3e3] border border-[#444746] cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
                Phiên âm IPA
              </label>
              <Input
                value={formIpa}
                onChange={(e) => setFormIpa(e.target.value)}
                placeholder="[ɡuːtn̩ ˈtaːk]"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
                Chủ đề / Nhóm từ
              </label>
              <Input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                placeholder="giao tiếp, ăn uống, nhà ở..."
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Nghĩa tiếng Việt *
            </label>
            <Input
              required
              value={formVietnamese}
              onChange={(e) => setFormVietnamese(e.target.value)}
              placeholder="Ví dụ: chào buổi trưa, cái bàn..."
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Câu ví dụ tiếng Đức
            </label>
            <Input
              value={formExample}
              onChange={(e) => setFormExample(e.target.value)}
              placeholder="Guten Tag, wie geht es Ihnen?"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Dịch nghĩa câu ví dụ
            </label>
            <Input
              value={formExampleVi}
              onChange={(e) => setFormExampleVi(e.target.value)}
              placeholder="Chào buổi trưa, ngài khỏe không?"
            />
          </div>

          <div className="pt-3 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddModalOpen(false)}
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
              Thêm vào kho
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Word */}
      <Modal
        isOpen={!!editingWord}
        onClose={() => setEditingWord(null)}
        title="Chỉnh sửa từ vựng tiếng Đức"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 mt-2">
          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Từ / Cụm từ tiếng Đức *
            </label>
            <div className="flex gap-2">
              <Input
                required
                value={formGerman}
                onChange={(e) => setFormGerman(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => formGerman && speakGerman(formGerman, 1.0)}
                style={{ borderRadius: 9999 }}
                className="shrink-0 h-13 w-13 cursor-pointer"
              >
                <Volume2 className="h-5 w-5 text-[#a8c7fa]" />
              </Button>
            </div>
            {/* Quick Umlaut Toolbar */}
            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
              {GERMAN_UMLAUTS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => handleInsertFormAccent(c)}
                  style={{ borderRadius: 12 }}
                  className="h-8 w-8 bg-[#1e1f20] hover:bg-[#333538] text-xs font-semibold text-[#e3e3e3] border border-[#444746] cursor-pointer"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
                Phiên âm IPA
              </label>
              <Input
                value={formIpa}
                onChange={(e) => setFormIpa(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
                Chủ đề
              </label>
              <Input
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Nghĩa tiếng Việt *
            </label>
            <Input
              required
              value={formVietnamese}
              onChange={(e) => setFormVietnamese(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Câu ví dụ tiếng Đức
            </label>
            <Input
              value={formExample}
              onChange={(e) => setFormExample(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-medium text-[#c4c7c5] mb-1.5 block">
              Dịch nghĩa câu ví dụ
            </label>
            <Input
              value={formExampleVi}
              onChange={(e) => setFormExampleVi(e.target.value)}
            />
          </div>

          <div className="pt-3 flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingWord(null)}
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
              Lưu thay đổi
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal: Delete Confirmation */}
      <Modal
        isOpen={!!deleteConfirmWord}
        onClose={() => setDeleteConfirmWord(null)}
        title="Xác nhận xóa từ vựng"
      >
        <div className="space-y-4">
          <p className="text-sm text-[#c4c7c5]">
            Bạn có chắc chắn muốn xóa từ{' '}
            <strong className="text-white">\"{deleteConfirmWord?.german || deleteConfirmWord?.french}\"</strong> khỏi kho từ
            vựng không? Dữ liệu lịch sử ôn tập của từ này sẽ bị xóa vĩnh viễn.
          </p>

          <div className="flex gap-3 pt-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteConfirmWord(null)}
              style={{ borderRadius: 9999 }}
              className="flex-1 cursor-pointer h-12"
            >
              Hủy
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              style={{ borderRadius: 9999 }}
              className="flex-1 cursor-pointer h-12"
            >
              Xóa vĩnh viễn
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
