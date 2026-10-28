/**
 * Auto-Seed 473 Goethe A1 Vocabulary words to Supabase
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fymkaishwfxtveykaytg.supabase.co'
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ5bWthaXNod2Z4dHZleWtheXRnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMxMzg3NDUsImV4cCI6MjEwODcxNDc0NX0.Tme5xU1AirNHaeNvn6Tbxx-D_Md-fZ8dSI6sXHQMOSo'

const client = createClient(SUPABASE_URL, SUPABASE_KEY)

async function seed() {
  console.log(`Connecting to Supabase at ${SUPABASE_URL}...`)

  const dataPath = path.resolve(__dirname, '../src/data/vocab_goethe_a1.json')
  const rawData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  console.log(`Read ${rawData.length} raw Goethe A1 words from JSON.`)

  const today = new Date().toISOString().slice(0, 10)

  // Deduplicate by german word key
  const uniqueMap = new Map()
  for (const item of rawData) {
    const key = item.german.trim()
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, {
        german: key,
        vietnamese: item.vietnamese.trim(),
        ipa: item.ipa ? item.ipa.trim() : '',
        category: item.category ? item.category.trim() : 'chung',
        example: item.example ? item.example.trim() : '',
        example_vi: item.exampleVi ? item.exampleVi.trim() : '',
        repetition: 0,
        interval: 0,
        ease_factor: 2.5,
        due_date: today,
        mistakes: 0
      })
    } else {
      // Merge examples if duplicate exists
      const existing = uniqueMap.get(key)
      if (item.example && !existing.example.includes(item.example)) {
        existing.example += ` ${item.example}`
        existing.example_vi += ` ${item.exampleVi}`
      }
    }
  }

  const formattedWords = Array.from(uniqueMap.values())
  console.log(`Deduplicated to ${formattedWords.length} unique words ready for upsert.`)

  const batchSize = 100
  let totalUploaded = 0

  for (let i = 0; i < formattedWords.length; i += batchSize) {
    const chunk = formattedWords.slice(i, i + batchSize)
    const { error } = await client
      .from('words')
      .upsert(chunk, { onConflict: 'german' })
      .select('id')

    if (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error.message)
      return
    }

    totalUploaded += chunk.length
    console.log(`Uploaded batch ${Math.floor(i / batchSize) + 1} (${totalUploaded}/${formattedWords.length} words)...`)
  }

  console.log(`\n🎉 THÀNH CÔNG RỰC RỠ! Đã nạp đầy đủ ${totalUploaded} từ vựng Goethe-Zertifikat A1 lên Supabase!`)
}

seed().catch((err) => {
  console.error('Lỗi seed:', err)
})
