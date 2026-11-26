// exportFeedback.js — builds the AgentEval "Import feedback" JSON document
// from AuraDesk's live conversation state (messages + 👍/👎 ratings) and
// triggers a browser download.
//
// Format: https://github.com/RhugvedWaydande/agent-eval-dashboard/blob/arena/e97caf3c-agent-eval-dashboard/FEEDBACK_IMPORT.md
// Root: { "version": 1, "feedback": [ { id, rating, prompt, response, timestamp } ] }.
// AgentEval's parseFeedbackImport() requires: version === 1; feedback is an
// array of 1–1000 records; each record has a unique non-empty string `id`,
// `rating` of "up" or "down", non-empty `prompt`/`response` strings, and an
// ISO 8601 `timestamp` WITH a timezone (Z or ±HH:MM). `comment` is optional.
// This module mirrors those rules so what we export imports cleanly.
//
// IMPORTANT (user-initiated): the download only starts when the user clicks
// the "Export feedback" button, and the file contains conversation data —
// the rated prompts and replies with their ratings, IDs, and timestamps.

/** Name the downloaded file gets. */
export const FEEDBACK_FILE_NAME = 'auradesk-feedback.json'

/** Format version — AgentEval imports only `version: 1` today. */
export const FEEDBACK_FORMAT_VERSION = 1

/** Max characters per exported text field (mirrors AgentEval's import limit). */
export const EXPORT_MAX_TEXT = 5000

function exportableRating(value) {
  return value === 'up' || value === 'down'
}

/** ISO 8601 timestamp WITH a timezone, as AgentEval requires. Returns '' when
 *  the timestamp can't be read, mirroring the "non-empty string" rule. */
function toIsoTimestamp(at) {
  if (typeof at !== 'number' || !Number.isFinite(at)) return ''
  const iso = new Date(at).toISOString()
  return Number.isNaN(Date.parse(iso)) ? '' : iso
}

/**
 * Builds the AgentEval-compatible export document for the current session.
 *
 * @param {Array<{ id: string, role: 'user'|'agent', text: string, at: number }>} messages
 *   AuraDesk's message list (see App.jsx).
 * @param {Record<string, 'up'|'down'|null>} feedback
 *   messageId -> rating (App.jsx stores null when unrated/toggled off).
 * @returns {{ version: number, feedback: Array<{ id: string, rating: 'up'|'down', prompt: string, response: string, timestamp: string }> }}
 */
export function buildFeedbackExport({ messages, feedback } = {}) {
  const records = []
  for (let i = 0; i < (messages?.length ?? 0); i++) {
    const message = messages[i]
    if (message?.role !== 'agent') continue
    const rating = feedback?.[message.id]
    if (!exportableRating(rating)) continue // only RATED replies are exported
    // The prompt is the closest earlier user message (the question this
    // reply answered), if there is one.
    const promptMessage = messages.slice(0, i).reverse().find(m => m?.role === 'user')
    records.push({
      id: String(message.id),
      rating,
      prompt: String(promptMessage?.text ?? ''),
      response: String(message.text ?? ''),
      timestamp: toIsoTimestamp(message.at)
    })
  }
  return { version: FEEDBACK_FORMAT_VERSION, feedback: records }
}

/** Serializes the export document (pretty-printed, 2-space indent). */
export function serializeFeedbackExport(exportData) {
  return JSON.stringify(exportData, null, 2) + '\n'
}

/**
 * Builds the export and triggers the browser download of it.
 * Returns the export document that was written, so callers/tests can see it.
 */
export function downloadFeedbackExport({ messages, feedback } = {}) {
  const exportData = buildFeedbackExport({ messages, feedback })
  const json = serializeFeedbackExport(exportData)

  // Path A: the classic anchor-click download (works in normal browsing).
  try {
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = FEEDBACK_FILE_NAME
    document.body.appendChild(link)
    link.click()
    link.remove()
    // Revoke the object URL a tick later: revoking it synchronously right
    // after click() can cancel the download in some browsers (the click may
    // be processed asynchronously, so give it a turn first).
    setTimeout(() => URL.revokeObjectURL(url), 0)
  } catch (error) {
    console.error('[AuraDesk] anchor download failed, trying fallback', error)
    // Path B: fall back to opening the blob URL — some browsers/iframes block
    // programmatic anchor downloads but still allow opening blob URLs.
    try {
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
      window.open(url, '_blank', 'noopener')
      setTimeout(() => URL.revokeObjectURL(url), 30000) // the opened tab may still need it
    } catch { /* nothing more we can do */ }
  }
  return exportData
}
