/**
 * Local Notification manager for Ambitieux PWA
 */

export interface ReminderConfig {
  enabled: boolean
  hour: number // 0-23
  minute: number // 0-59
}

const STORAGE_KEY = 'ambitieux_reminder_config'

export function getReminderConfig(): ReminderConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    // Fallback
  }
  return { enabled: false, hour: 20, minute: 0 } // Default 8:00 PM
}

export function saveReminderConfig(config: ReminderConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
  } catch {
    // Ignore
  }
}

/**
 * Request notification permission from user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    console.warn('Notifications not supported on this device/browser')
    return 'denied'
  }
  return await Notification.requestPermission()
}

/**
 * Check if notifications are granted
 */
export function isNotificationGranted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return false
  }
  return Notification.permission === 'granted'
}

/**
 * Send an immediate notification
 */
export function sendNotification(title: string, body: string, icon = '/icons/icon-192.png'): void {
  if (!isNotificationGranted()) return

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon,
          badge: icon,
          vibrate: [200, 100, 200]
        } as NotificationOptions)
      })
    } else {
      new Notification(title, {
        body,
        icon
      })
    }
  } catch (err) {
    console.warn('Error showing notification:', err)
  }
}
