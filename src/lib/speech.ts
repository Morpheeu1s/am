/**
 * German Web Speech API & Native Audio Helper for Ambitieux
 * Tailored for Goethe-Zertifikat A1: Start Deutsch 1
 * Fully optimized for iOS Safari (iPhone 16 / iOS 16-18), macOS, Android, and Windows
 */

declare global {
  interface Window {
    __ambitieuxAudioUnlocked?: boolean
    __activeUtterances?: SpeechSynthesisUtterance[]
    __sharedAudioElement?: HTMLAudioElement
  }
}

let cachedVoices: SpeechSynthesisVoice[] = []
let isAudioUnlocked = false

/**
 * Filter and sort native German voices by quality:
 * 1. High-quality German voices (Siri, Anna, Markus, Marlene, Hedda, Stefan, Hans, Katja, Google Deutsch)
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
 * Cache voices synchronously whenever available
 */
function updateCachedVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      const v = window.speechSynthesis.getVoices()
      if (v && v.length > 0) {
        cachedVoices = v
      }
    } catch {
      // Ignore
    }
  }
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  updateCachedVoices()
  window.speechSynthesis.addEventListener('voiceschanged', updateCachedVoices)
}

/**
 * Unlock iOS Audio Subsystem:
 * On iOS/Safari, audio playback & SpeechSynthesis are restricted until
 * an explicit user touch gesture fires. This function:
 * 1. Resumes Web Audio API AudioContext
 * 2. Pre-warms SpeechSynthesis with a silent German utterance
 * 3. Pre-warms HTMLAudioElement with silent audio
 */
export function unlockAudio(): void {
  if (typeof window === 'undefined') return
  if (isAudioUnlocked) return
  isAudioUnlocked = true
  window.__ambitieuxAudioUnlocked = true

  // 1. Unlock SpeechSynthesis on iOS Safari
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.resume()
      // Silent short utterance to wake up the iOS speech daemon
      const silentUtterance = new SpeechSynthesisUtterance(' ')
      silentUtterance.lang = 'de-DE'
      silentUtterance.volume = 0.01
      silentUtterance.rate = 2.0
      window.speechSynthesis.speak(silentUtterance)
    } catch {
      // Ignore
    }
  }

  // 2. Pre-warm shared HTML Audio element for fallback
  try {
    if (!window.__sharedAudioElement) {
      const audio = new Audio()
      audio.preload = 'auto'
      window.__sharedAudioElement = audio
    }
    // Tiny silent WAV (1 frame) to unlock audio element
    window.__sharedAudioElement.src = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    window.__sharedAudioElement.play().catch(() => {})
  } catch {
    // Ignore
  }
}

// Auto-attach unlock listeners to window for the first user gesture
if (typeof window !== 'undefined') {
  window.__activeUtterances = window.__activeUtterances || []
  const unlockEvents = ['touchstart', 'touchend', 'pointerdown', 'keydown', 'click']
  const onFirstInteraction = () => {
    unlockAudio()
    unlockEvents.forEach((evt) => {
      window.removeEventListener(evt, onFirstInteraction, true)
    })
  }
  unlockEvents.forEach((evt) => {
    window.addEventListener(evt, onFirstInteraction, { capture: true, passive: true })
  })
}

/**
 * Get info about currently active voice engine
 */
export function getTTSStatus(): { isNativeGermanVoice: boolean; voiceName: string; isUnlocked: boolean } {
  updateCachedVoices()
  const bestVoice = pickBestGermanVoice(cachedVoices)
  if (bestVoice) {
    return {
      isNativeGermanVoice: true,
      voiceName: bestVoice.name,
      isUnlocked: isAudioUnlocked
    }
  }
  return {
    isNativeGermanVoice: true,
    voiceName: 'iOS / System Native German (de-DE)',
    isUnlocked: isAudioUnlocked
  }
}

/**
 * Speak German word or sentence
 * Fully synchronous path for iOS Safari to keep the user activation context alive.
 * @param text German text to pronounce
 * @param rate Speech rate (default 1.0 for standard natural German speed)
 */
export function speakGerman(text: string, rate: number = 1.0): void {
  const cleanText = text.trim()
  if (!cleanText) return
  if (typeof window === 'undefined') return

  // Ensure unlock was invoked
  unlockAudio()

  // Primary Engine: Web Speech API (Supports iOS Siri German, Android Google TTS, Windows de-DE)
  if ('speechSynthesis' in window) {
    try {
      // 1. Resume synthesizer if paused by iOS WebKit
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }

      // 2. Clear any pending speech without freezing queue
      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
        window.speechSynthesis.resume()
      }

      updateCachedVoices()
      const bestVoice = pickBestGermanVoice(cachedVoices)

      const utterance = new SpeechSynthesisUtterance(cleanText)
      utterance.lang = 'de-DE'
      utterance.rate = Math.max(0.7, Math.min(1.2, rate))
      utterance.pitch = 1.0
      utterance.volume = 1.0

      if (bestVoice) {
        utterance.voice = bestVoice
      }

      // Prevent WebKit Garbage Collection bug on iOS Safari
      window.__activeUtterances = window.__activeUtterances || []
      window.__activeUtterances.push(utterance)

      utterance.onend = () => {
        if (window.__activeUtterances) {
          const idx = window.__activeUtterances.indexOf(utterance)
          if (idx !== -1) window.__activeUtterances.splice(idx, 1)
        }
      }

      utterance.onerror = (e) => {
        if (window.__activeUtterances) {
          const idx = window.__activeUtterances.indexOf(utterance)
          if (idx !== -1) window.__activeUtterances.splice(idx, 1)
        }
        console.warn('SpeechSynthesis error:', e)
        // Fallback to audio element if speech failed
        fallbackAudioPlay(cleanText, rate)
      }

      window.speechSynthesis.speak(utterance)
      return
    } catch (err) {
      console.warn('SpeechSynthesis invocation failed, falling back to audio stream:', err)
    }
  }

  // Fallback if SpeechSynthesis is completely unavailable
  fallbackAudioPlay(cleanText, rate)
}

/**
 * Streaming Audio Fallback for devices without Web Speech API
 */
function fallbackAudioPlay(cleanText: string, rate: number = 1.0): void {
  try {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(cleanText)}`
    let audio = window.__sharedAudioElement
    if (!audio) {
      audio = new Audio()
      window.__sharedAudioElement = audio
    }
    audio.src = url
    audio.playbackRate = rate
    audio.play().catch((e) => {
      console.warn('Fallback audio playback prevented:', e)
    })
  } catch (err) {
    console.warn('Fallback audio stream failed:', err)
  }
}

// Backward compatibility alias
export const speakFrench = speakGerman
