import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { db } from './db'
import type { Word } from '@/types'

const LOCAL_STORAGE_URL_KEY = 'ambitieux_supabase_url'
const LOCAL_STORAGE_ANON_KEY = 'ambitieux_supabase_anon_key'

/**
 * Get credentials from environment variables or localStorage fallback
 */
export function getSupabaseCredentials(): { url: string; key: string } {
  const envUrl = import.meta.env.VITE_SUPABASE_URL || ''
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

  if (typeof window === 'undefined') {
    return { url: envUrl, key: envKey }
  }

  const storedUrl = localStorage.getItem(LOCAL_STORAGE_URL_KEY) || ''
  const storedKey = localStorage.getItem(LOCAL_STORAGE_ANON_KEY) || ''

  return {
    url: storedUrl || envUrl,
    key: storedKey || envKey
  }
}

export function saveSupabaseCredentials(url: string, key: string): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(LOCAL_STORAGE_URL_KEY, url.trim())
  localStorage.setItem(LOCAL_STORAGE_ANON_KEY, key.trim())
  supabaseInstance = null // Reset cached client
}

export function clearSupabaseCredentials(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(LOCAL_STORAGE_URL_KEY)
  localStorage.removeItem(LOCAL_STORAGE_ANON_KEY)
  supabaseInstance = null
}

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseClient(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance

  const { url, key } = getSupabaseCredentials()
  if (!url || !key) return null

  try {
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true
      }
    })
    return supabaseInstance
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err)
    return null
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, key } = getSupabaseCredentials()
  return Boolean(url && key)
}

/**
 * Test connectivity with Supabase project
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string }> {
  const client = getSupabaseClient()
  if (!client) {
    return { success: false, message: 'Chưa cấu hình Supabase URL hoặc Anon Key.' }
  }

  try {
    const { error } = await client.from('words').select('id').limit(1)
    if (error) {
      // If table doesn't exist yet, provide helpful hint
      if (error.code === '42P01') {
        return {
          success: false,
          message: 'Đã kết nối tới Supabase nhưng chưa tạo bảng "words". Hãy chạy file schema.sql trong SQL Editor.'
        }
      }
      return { success: false, message: `Lỗi kết nối: ${error.message}` }
    }
    return { success: true, message: 'Kết nối Supabase thành công! Dữ liệu sẵn sàng đồng bộ.' }
  } catch (err) {
    return { success: false, message: `Lỗi mạng hoặc kết nối: ${String(err)}` }
  }
}

/**
 * Push all local IndexedDB words to Supabase
 */
export async function pushLocalToSupabase(): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient()
  if (!client) {
    return { count: 0, error: 'Chưa cấu hình Supabase.' }
  }

  const localWords = await db.words.toArray()
  if (localWords.length === 0) {
    return { count: 0 }
  }

  // Format local words to Supabase table schema
  const payload = localWords.map((w) => ({
    german: w.german || w.french || '',
    vietnamese: w.vietnamese,
    ipa: w.ipa || '',
    category: w.category || 'chung',
    example: w.example || '',
    example_vi: w.exampleVi || '',
    repetition: w.repetition ?? 0,
    interval: w.interval ?? 0,
    ease_factor: w.easeFactor ?? 2.5,
    due_date: w.dueDate,
    mistakes: w.mistakes ?? 0
  }))

  // Batch insert/upsert into Supabase (batches of 100)
  const batchSize = 100
  let uploaded = 0

  for (let i = 0; i < payload.length; i += batchSize) {
    const chunk = payload.slice(i, i + batchSize)
    const { error } = await client.from('words').upsert(chunk, { onConflict: 'german' })
    if (error) {
      console.error('Supabase upload batch error:', error)
      return { count: uploaded, error: error.message }
    }
    uploaded += chunk.length
  }

  return { count: uploaded }
}

/**
 * Pull cloud words from Supabase down to local IndexedDB
 */
export async function pullSupabaseToLocal(): Promise<{ count: number; error?: string }> {
  const client = getSupabaseClient()
  if (!client) {
    return { count: 0, error: 'Chưa cấu hình Supabase.' }
  }

  try {
    const { data, error } = await client.from('words').select('*')
    if (error) {
      return { count: 0, error: error.message }
    }

    if (!data || data.length === 0) {
      return { count: 0 }
    }

    // Upsert into IndexedDB
    const existingWords = await db.words.toArray()
    const existingMap = new Map(existingWords.map((w) => [(w.german || w.french || '').toLowerCase(), w]))

    let syncedCount = 0

    for (const remote of data) {
      const germanKey = (remote.german || '').toLowerCase()
      const existing = existingMap.get(germanKey)

      const formatted: Word = {
        german: remote.german,
        french: remote.german,
        ipa: remote.ipa || '',
        vietnamese: remote.vietnamese,
        category: remote.category || 'chung',
        example: remote.example || '',
        exampleVi: remote.example_vi || '',
        repetition: remote.repetition ?? 0,
        interval: remote.interval ?? 0,
        easeFactor: Number(remote.ease_factor) || 2.5,
        dueDate: remote.due_date,
        mistakes: remote.mistakes ?? 0
      }

      if (existing && existing.id) {
        await db.words.update(existing.id, formatted)
      } else {
        await db.words.add(formatted)
      }
      syncedCount++
    }

    return { count: syncedCount }
  } catch (err) {
    return { count: 0, error: String(err) }
  }
}
