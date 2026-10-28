/**
 * German Web Speech API & Native Audio Helper for Ambitieux
 * Tailored for Goethe-Zertifikat A1: Start Deutsch 1
 * Optimized for iOS/Safari, macOS, Android, and Windows (Chrome/Edge/Firefox)
 */

let cachedVoices: SpeechSynthesisVoice[] = []
let currentAudio: HTMLAudioElement | null = null

/**
 * Filter and sort native German voices by quality:
 * 1. High-quality German voices (e.g., Siri, Anna, Markus, Marlene, Hedda, Stefan, Hans, Katja, Google Deutsch)
 * 2. de-DE regional voices
 * 3. Any German voice (de-AT, de-CH)
 */
export function pickBestGermanVoice(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined {
  if (!voices || voices.length === 0) return undefined

  const germanVoices = voices.filter((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-')
    const name = (v.name || '').toLowerCase()
    return (
      lang.startsWith('de') ||
      lang.includes('german') ||
      name.includes('deutsch') ||
      name.includes('german') ||
      name.includes('hedda') ||
      name.includes('stefan') ||
      name.includes('marlene') ||
      name.includes('hans') ||
      name.includes('anna') ||
      name.includes('katja') ||
      name.includes('siri')
    )
  })

  if (germanVoices.length === 0) return undefined

  // Priority 1: High quality known iOS & macOS & Edge Natural German voices
  const preferredNames = [
    'siri',
    'natural',
    'online',
    'google deutsch',
    'anna',
    'marlene',
    'hedda',
    'stefan',
    'hans',
    'katja',
    'markus'
  ]
  for (const name of preferredNames) {
    const found = germanVoices.find((v) => {
      const vName = v.name.toLowerCase()
      const vLang = (v.lang || '').toLowerCase().replace('_', '-')
      return vName.includes(name) && (vLang.startsWith('de') || vLang === '')
    })
    if (found) return found
  }

  // Priority 2: de-DE native / local service voices
  const deDE = germanVoices.find((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-')
    return lang === 'de-de' && v.localService
  })
  if (deDE) return deDE

  // Priority 3: any de-DE voice
  const anyDeDE = germanVoices.find((v) => {
    const lang = (v.lang || '').toLowerCase().replace('_', '-')
    return lang.startsWith('de-de')
  })
  if (anyDeDE) return anyDeDE

  // Priority 4: first available German voice
  return germanVoices[0]
}

/**
 * Load available voices from SpeechSynthesis
 */
export function getGermanVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      resolve([])
      return
    }

    const currentVoices = window.speechSynthesis.getVoices()
    if (currentVoices.length > 0) {
      cachedVoices = currentVoices
      resolve(currentVoices)
      return
    }

    const handler = () => {
      cachedVoices = window.speechSynthesis.getVoices()
      window.speechSynthesis.removeEventListener('voiceschanged', handler)
      resolve(cachedVoices)
    }

    window.speechSynthesis.addEventListener('voiceschanged', handler)

    // Fallback timeout in case voiceschanged does not fire
    setTimeout(() => {
      cachedVoices = window.speechSynthesis.getVoices()
      resolve(cachedVoices)
    }, 400)
  })
}

// Pre-load voices if SpeechSynthesis is available
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoices = window.speechSynthesis.getVoices()
  })
  cachedVoices = window.speechSynthesis.getVoices()
}

/**
 * Get info about currently active voice engine
 */
export function getTTSStatus(): { isNativeGermanVoice: boolean; voiceName: string } {
  const bestVoice = pickBestGermanVoice(cachedVoices)
  if (bestVoice) {
    return {
      isNativeGermanVoice: true,
      voiceName: bestVoice.name
    }
  }
  return {
    isNativeGermanVoice: false,
    voiceName: 'Google German Audio (Bản xứ Đức)'
  }
}

/**
 * Speak German word or sentence
 * 1. If device has a German voice (iOS/iPhone, Mac, Android, Windows with German Pack): uses Web Speech API (de-DE).
 * 2. If device has NO German voice installed: uses Google TTS authentic native German audio,
 *    NEVER falling back to an English voice!
 * @param text German text to pronounce
 * @param rate Speech rate (default 1.0 for standard natural German speed)
 */
export async function speakGerman(text: string, rate: number = 1.0): Promise<void> {
  const cleanText = text.trim()
  if (!cleanText) return

  // 1. Stop any currently playing HTML Audio
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.currentTime = 0
    currentAudio = null
  }

  // 2. Stop any ongoing SpeechSynthesis
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

  const voices = cachedVoices.length > 0 ? cachedVoices : await getGermanVoices()
  const bestVoice = pickBestGermanVoice(voices)

  // A. Native German voice detected on device (iOS Siri, Anna, Marlene, Hedda, etc.)
  if (bestVoice && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.voice = bestVoice
    utterance.lang = bestVoice.lang || 'de-DE'
    utterance.rate = rate
    utterance.pitch = 1.0

    // Prevent GC cleanup in Chrome
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(window as any).__lastSpeechUtterance = utterance

    window.speechSynthesis.speak(utterance)
    return
  }

  // B. Fallback: On devices with NO German voice installed,
  // stream authentic native German audio from Google TTS (tl=de)
  if (typeof window !== 'undefined' && typeof Audio !== 'undefined') {
    try {
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(cleanText)}`
      const audio = new Audio(url)
      audio.playbackRate = rate
      currentAudio = audio
      await audio.play()
      return
    } catch (e) {
      console.warn('Audio playback was prevented or failed:', e)
    }
  }

  // C. Fallback only if offline and no audio network:
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(cleanText)
    utterance.lang = 'de-DE'
    utterance.rate = rate
    window.speechSynthesis.speak(utterance)
  }
}

// Backward compatibility alias
export const speakFrench = speakGerman
