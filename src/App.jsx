// App.jsx — the top-level React component: owns all STATE and the layout.
// CONCEPT (React): state lives here and flows DOWN into child components as
// props; children send events UP via callbacks. One-way data flow.
//   - messages:     the chat history (user + agent bubbles)
//   - traceEvents:  every internal step the agent takes (for the trace panel)
//   - actions:      cumulative log of real actions taken (tickets, refunds…)
//   - stats:        live session counters shown in the header
//   - feedback:     👍/👎 per agent reply — the seed data for Project 2 (evals!)
//   - settings:     user-configurable branding (store name), persisted in localStorage
import { useState, useEffect } from 'react'
import ChatPanel from './components/ChatPanel.jsx'
import RightPanel from './components/RightPanel.jsx'
import Logo from './components/Logo.jsx'
import { runAgent } from './agent/agent.js'
import { hasLiveLLM } from './agent/llm.js'
import { getSettings, saveSettings } from './settings.js'

/** Small modal for editing settings (currently: the store Aura works for). */
function SettingsModal({ settings, onSave, onClose }) {
  const [storeName, setStoreName] = useState(settings.storeName)

  function submit(event) {
    event.preventDefault()
    onSave({ ...settings, storeName: storeName.trim() || 'Nimbus Gear' })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      {/* stopPropagation: clicking inside the card shouldn't close the modal */}
      <form className="modal glass" onClick={event => event.stopPropagation()} onSubmit={submit}>
        <h3>⚙️ Workspace settings</h3>
        <label>
          Store name
          <input
            value={storeName}
            onChange={event => setStoreName(event.target.value)}
            placeholder="Nimbus Gear"
            maxLength={40}
            autoFocus
          />
        </label>
        <p className="modal-hint">
          Shown in the header, welcome screen, and the LLM system prompt.
          (Demo orders & articles keep their Nimbus product names.)
        </p>
        <div className="modal-actions">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary">Save</button>
        </div>
      </form>
    </div>
  )
}

export default function App() {
  const [messages, setMessages] = useState([])
  const [traceEvents, setTraceEvents] = useState([])
  const [isThinking, setIsThinking] = useState(false)
  const [actions, setActions] = useState([])
  const [stats, setStats] = useState({ handled: 0, toolCalls: 0, guardrails: 0 })
  const [feedback, setFeedback] = useState({}) // messageId -> 'up' | 'down'
  const [settings, setSettings] = useState(getSettings) // lazy init from localStorage
  const [showSettings, setShowSettings] = useState(false)
  const [showPanel, setShowPanel] = useState(true) // Agent Trace panel visible?

  // THEMING: one attribute on <html> flips every CSS variable (see styles.css).
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme)
  }, [settings.theme])

  /** Flip between dark and light theme, persisted like any other setting. */
  function toggleTheme() {
    const next = { ...settings, theme: settings.theme === 'dark' ? 'light' : 'dark' }
    setSettings(next)
    saveSettings(next)
  }

  /** Receives every trace event from the agent and fans it out:
   *  into the trace list, the stats counters, and the actions log. */
  function handleTraceEvent(event) {
    setTraceEvents(prev => [...prev, { ...event, at: Date.now() }])

    if (event.type === 'tool_call') {
      setStats(s => ({ ...s, toolCalls: s.toolCalls + 1 }))
    }
    if (event.type === 'guardrail' && event.rule !== 'PASS') {
      setStats(s => ({ ...s, guardrails: s.guardrails + 1 }))
    }
    if (event.type === 'tool_result' && event.result?.ok) {
      const r = event.result
      const stamp = Date.now()
      if (r.order) setActions(a => [...a, { icon: '📦', title: `Order lookup — ${r.order.id}`, meta: `${r.order.item} · ${r.order.status}`, at: stamp }])
      if (r.refund) setActions(a => [...a, { icon: '💸', title: `Refund processed — ${r.refund.refundId}`, meta: `₹${r.refund.amount.toLocaleString('en-IN')} for ${r.refund.orderId}`, at: stamp }])
      if (r.ticket) setActions(a => [...a, { icon: '🎫', title: `Ticket created — ${r.ticket.ticketId}`, meta: `${r.ticket.subject} · priority ${r.ticket.priority}`, at: stamp }])
      if (r.escalation) setActions(a => [...a, { icon: '🧑‍💼', title: 'Escalated to human', meta: r.escalation.reason, at: stamp }])
    }
  }

  /** Called when the user sends a message. Runs the full agent pipeline. */
  async function handleSend(text) {
    if (!text.trim() || isThinking) return

    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'user', text, at: Date.now() }])
    setIsThinking(true)
    setTraceEvents([]) // fresh trace for each question

    const reply = await runAgent(text, handleTraceEvent)

    // animate: true -> ChatPanel renders this reply with the typewriter effect
    setMessages(prev => [...prev, { id: crypto.randomUUID(), role: 'agent', text: reply, at: Date.now(), animate: true }])
    setStats(s => ({ ...s, handled: s.handled + 1 }))
    setIsThinking(false)
  }

  /** 👍/👎 on an agent reply — stored per message id. */
  function handleFeedback(messageId, value) {
    setFeedback(prev => ({ ...prev, [messageId]: prev[messageId] === value ? null : value }))
  }

  /** Start over: wipe the whole session. */
  function handleReset() {
    if (isThinking) return
    setMessages([])
    setTraceEvents([])
    setActions([])
    setStats({ handled: 0, toolCalls: 0, guardrails: 0 })
    setFeedback({})
  }

  /** Persist settings and close the modal. */
  function handleSaveSettings(next) {
    setSettings(next)
    saveSettings(next)
    setShowSettings(false)
  }

  return (
    <div className="app">
      <header className="topbar glass">
        <div className="brand">
          <Logo size={36} pulse />
          <div className="brand-text">
            <span className="brand-name">AuraDesk</span>
            <span className="brand-sub">Aura · AI support agent for {settings.storeName}</span>
          </div>
        </div>

        <div className="stats-strip">
          <div className="stat"><strong>{stats.handled}</strong><span>handled</span></div>
          <div className="stat"><strong>{stats.toolCalls}</strong><span>tool calls</span></div>
          <div className="stat"><strong>{stats.guardrails}</strong><span>guardrails</span></div>
        </div>

        <div className="topbar-right">
          <span className={`mode-badge ${hasLiveLLM ? 'live' : 'demo'}`}>
            {hasLiveLLM ? '● LIVE LLM' : '● DEMO MODE'}
          </span>
          <button className="icon-btn" onClick={toggleTheme} title={settings.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {settings.theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button className="icon-btn" onClick={() => setShowSettings(true)} title="Settings">⚙️</button>
          <button className="reset-btn" onClick={handleReset} disabled={isThinking} title="Start a new conversation">
            ⟳ New chat
          </button>
        </div>
      </header>

      <main className={`layout ${showPanel ? '' : 'panel-collapsed'}`}>
        <ChatPanel
          messages={messages}
          isThinking={isThinking}
          feedback={feedback}
          storeName={settings.storeName}
          onFeedback={handleFeedback}
          onSend={handleSend}
        />
        {showPanel ? (
          <RightPanel
            events={traceEvents}
            actions={actions}
            isThinking={isThinking}
            onCollapse={() => setShowPanel(false)}
          />
        ) : (
          /* Collapsed state: the panel shrinks to a slim rail that stays
             visible — click anywhere on it to expand the trace again. */
          <button className="panel-rail glass" onClick={() => setShowPanel(true)} title="Show the Agent Trace panel">
            <span className="rail-chevron">«</span>
            <span className="rail-label">🔬 Agent Trace</span>
          </button>
        )}
      </main>

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={handleSaveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  )
}
