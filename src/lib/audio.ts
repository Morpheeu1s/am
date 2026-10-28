/**
 * Web Audio API synthesizer & tactile feedback for Ambitieux
 * Procedural iOS click & feedback sounds + haptics
 */

export { speakFrench } from './speech'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume()
  }
  return audioCtx
}

export type FeedbackSound = 'click' | 'success' | 'typo' | 'error' | 'pop'

/**
 * Play subtle iOS-style sounds and trigger haptics
 */
export function playFeedback(type: FeedbackSound = 'click'): void {
  // Haptic feedback if available (Safari iOS / Android)
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      if (type === 'click') navigator.vibrate(8)
      else if (type === 'success') navigator.vibrate([15, 40, 20])
      else if (type === 'typo') navigator.vibrate([25, 30, 25])
      else if (type === 'error') navigator.vibrate([40, 40, 40])
      else if (type === 'pop') navigator.vibrate(12)
    } catch {
      // Ignore vibration errors
    }
  }

  // Audio synthesis feedback
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    if (type === 'click') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(800, now)
      osc.frequency.exponentialRampToValueAtTime(400, now + 0.03)
      gain.gain.setValueAtTime(0.04, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.03)
    } else if (type === 'pop') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(520, now)
      osc.frequency.exponentialRampToValueAtTime(980, now + 0.06)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.06)
    } else if (type === 'success') {
      // Two-tone cheerful chime (C6 -> G6)
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc2.type = 'sine'
      osc1.frequency.setValueAtTime(1046.5, now) // C6
      osc2.frequency.setValueAtTime(1567.98, now + 0.08) // G6

      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc1.stop(now + 0.08)
      osc2.start(now + 0.08)
      osc2.stop(now + 0.28)
    } else if (type === 'typo') {
      // Soft double warning tap
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(580, now)
      osc.frequency.setValueAtTime(440, now + 0.06)
      gain.gain.setValueAtTime(0.06, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.14)
    } else if (type === 'error') {
      // Low buzz
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(160, now + 0.15)
      gain.gain.setValueAtTime(0.05, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {
    // Ignore audio synthesis errors on locked browsers
  }
}
