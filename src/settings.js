// settings.js — tiny persistence layer for user-configurable settings.
// CONCEPT: localStorage keeps settings across page reloads with zero backend.
// One module owns the storage key and defaults; everyone else just calls
// getSettings()/saveSettings() — so swapping localStorage for a real API
// later means editing only this file (same idea as the LLM abstraction).

const STORAGE_KEY = 'auradesk-settings'

const DEFAULTS = {
  storeName: 'Nimbus Gear',
  theme: 'dark' // 'dark' | 'light'
}

export function getSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }
  } catch {
    return { ...DEFAULTS } // corrupted storage? fall back to defaults, never crash
  }
}

export function saveSettings(settings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}
