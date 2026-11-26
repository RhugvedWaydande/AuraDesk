// exportFeedback.test.js — unit tests for src/exportFeedback.js, run with
// `npm test` (node --test). These pin the AgentEval "Import feedback" shape
// (version 1 + feedback records with id/rating/prompt/response/timestamp) so
// the exported file always imports cleanly into AgentEval.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFeedbackExport,
  serializeFeedbackExport,
  downloadFeedbackExport,
  FEEDBACK_FILE_NAME,
  FEEDBACK_FORMAT_VERSION
} from './exportFeedback.js'

// Mirrors AgentEval's parseFeedbackImport() validation (FEEDBACK_IMPORT.md /
// feedbackImport.js in the dashboard repo) — every exported record must pass
// these checks for the file to import.
const AGENTEVAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/

function assertAgentEvalShape(exportData) {
  assert.equal(exportData.version, 1, 'root must be version 1')
  assert.ok(Array.isArray(exportData.feedback), 'feedback must be an array')
  assert.ok(exportData.feedback.length >= 1, 'file must include 1–1000 records')
  assert.ok(exportData.feedback.length <= 1000)
  const ids = new Set()
  for (const record of exportData.feedback) {
    for (const field of ['id', 'rating', 'prompt', 'response', 'timestamp']) {
      assert.equal(typeof record[field], 'string', `${field} must be a string`)
      assert.ok(record[field].trim().length > 0, `${field} must be non-empty`)
      assert.ok(record[field].length <= 5000, `${field} must be at most 5000 chars`)
    }
    assert.ok(['up', 'down'].includes(record.rating), 'rating must be up or down')
    assert.ok(AGENTEVAL_TIMESTAMP.test(record.timestamp), `timestamp must be ISO 8601 with a timezone, got: ${record.timestamp}`)
    assert.ok(!Number.isNaN(Date.parse(record.timestamp)), 'timestamp must parse')
    assert.ok(!ids.has(record.id), 'ids must be unique')
    ids.add(record.id)
  }
}

/** Standard 3-message session fixture: user, agent (rated up), user, agent (rated down). */
function fixture() {
  const base = Date.parse('2026-11-26T09:00:00Z')
  return {
    messages: [
      { id: 'u1', role: 'user', text: 'Where is my order ORD-1001?', at: base },
      { id: 'a1', role: 'agent', text: 'Your order is on its way.', at: base + 1000 },
      { id: 'u2', role: 'user', text: 'How long does shipping take?', at: base + 2000 },
      { id: 'a2', role: 'agent', text: 'Usually 2–3 business days.', at: base + 3000 },
    ],
    feedback: { a1: 'up', a2: 'down' },
  }
}

test('buildFeedbackExport returns the version-1 AgentEval shape', () => {
  const exportData = buildFeedbackExport(fixture())
  assertAgentEvalShape(exportData)
  assert.equal(exportData.version, FEEDBACK_FORMAT_VERSION)
  assert.equal(FEEDBACK_FORMAT_VERSION, 1)
})

test('exports only RATED agent replies (excludes unrated, null, user messages)', () => {
  const { messages } = fixture()
  const exportData = buildFeedbackExport({ messages, feedback: { a1: 'up', a2: null, a3: undefined } })
  assert.deepEqual(exportData.feedback.map(r => r.id), ['a1'])
})

test('records carry prompt, response, rating, id, and timestamp for each rated reply', () => {
  const exportData = buildFeedbackExport(fixture())
  assert.equal(exportData.feedback.length, 2)

  const first = exportData.feedback[0]
  assert.equal(first.id, 'a1')
  assert.equal(first.rating, 'up')
  assert.equal(first.prompt, 'Where is my order ORD-1001?')
  assert.equal(first.response, 'Your order is on its way.')

  const second = exportData.feedback[1]
  assert.equal(second.id, 'a2')
  assert.equal(second.rating, 'down')
  assert.equal(second.prompt, 'How long does shipping take?')
  assert.equal(second.response, 'Usually 2–3 business days.')
})

test('prompt is the CLOSEST earlier user message; order matches conversation order', () => {
  const base = Date.parse('2026-11-26T10:00:00Z')
  const exportData = buildFeedbackExport({
    messages: [
      { id: 'u1', role: 'user', text: 'first question', at: base },
      { id: 'a1', role: 'agent', text: 'first answer', at: base + 1 },
      { id: 'u2', role: 'user', text: 'second question', at: base + 2 },
      { id: 'a2', role: 'agent', text: 'second answer', at: base + 3 },
      { id: 'u3', role: 'user', text: 'third question', at: base + 4 },
      { id: 'a3', role: 'agent', text: 'third answer', at: base + 5 }
    ],
    feedback: { a1: 'up', a2: 'up', a3: 'up' }
  })
  assert.deepEqual(exportData.feedback.map(r => [r.id, r.prompt]), [
    ['a1', 'first question'],
    ['a2', 'second question'],
    ['a3', 'third question']
  ])
})

test('timestamps are ISO 8601 with a timezone and match the message time', () => {
  const base = Date.parse('2026-11-26T12:30:45Z')
  const exportData = buildFeedbackExport({
    messages: [
      { id: 'u1', role: 'user', text: 'q', at: base },
      { id: 'a1', role: 'agent', text: 'a', at: base + 1234 }
    ],
    feedback: { a1: 'up' }
  })
  assert.equal(exportData.feedback[0].timestamp, new Date(base + 1234).toISOString())
  assertAgentEvalShape(exportData)
})

test('exports an empty feedback array for a session with nothing rated', () => {
  const exportData = buildFeedbackExport({ messages: [], feedback: {} })
  assert.equal(exportData.version, 1)
  assert.deepEqual(exportData.feedback, [])
})

test('serializeFeedbackExport produces JSON that parses back to the same export', () => {
  const exportData = buildFeedbackExport(fixture())
  const text = serializeFeedbackExport(exportData)
  assert.equal(typeof text, 'string')
  assert.ok(text.startsWith('{'), 'pretty-printed JSON document')
  assert.deepEqual(JSON.parse(text), exportData)
})

test('downloadFeedbackExport triggers a browser download named auradesk-feedback.json', async () => {
  const state = { clicked: 0, link: null, revoked: false }
  const originalDocument = global.document
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL
  global.document = {
    body: { appendChild() {} },
    createElement() {
      return {
        href: '',
        download: '',
        click() { state.clicked++; state.link = { href: this.href, download: this.download } },
        remove() {}
      }
    }
  }
  URL.createObjectURL = () => 'blob:mock-url'
  URL.revokeObjectURL = () => { state.revoked = true }

  try {
    const exportData = downloadFeedbackExport(fixture())
    assert.equal(state.clicked, 1, 'the anchor should be clicked once to start the download')
    assert.ok(state.link, 'a download link was created')
    assert.equal(state.link.download, FEEDBACK_FILE_NAME)
    assert.ok(state.link.href, 'the link has an object URL for the file')
    assertAgentEvalShape(exportData)
    assert.deepEqual(exportData, buildFeedbackExport(fixture()), 'returned document matches the export')
    // The object URL is revoked a tick later (deferred, not synchronous).
    await new Promise(resolve => setTimeout(resolve, 10))
    assert.ok(state.revoked, 'the object URL is revoked after the click')
  } finally {
    global.document = originalDocument
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
  }
})
