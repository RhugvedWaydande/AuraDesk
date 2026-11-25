// RightPanel.jsx — the tabbed right panel, three views of the agent's inner life:
//   🔬 Trace     — live log of thoughts, retrievals, guardrails, tool calls
//                  (CONCEPT: observability — what LangSmith/Langfuse sell)
//   📋 Actions   — cumulative record of real side effects (tickets, refunds…)
//                  proving this is an AGENT, not a chatbot
//   📚 Knowledge — the RAG source articles, browsable for full transparency
import { useRef, useEffect, useState } from 'react'
import { getKnowledgeBase } from '../agent/knowledgeBase.js'

const EVENT_STYLES = {
  thought:     { icon: '💭', label: 'Thought' },
  guardrail:   { icon: '🛡️', label: 'Guardrail' },
  retrieval:   { icon: '📚', label: 'RAG Retrieval' },
  tool_call:   { icon: '🔧', label: 'Tool Call' },
  tool_result: { icon: '📥', label: 'Tool Result' },
  response:    { icon: '✉️', label: 'Response' }
}

/** Human-readable one-liner for a tool result, so the trace stays scannable
 *  (the full JSON lives behind the collapsed "view payload" toggle). */
function summarizeResult(result) {
  if (!result) return null
  if (!result.ok) return `⚠️ ${result.error}`
  if (result.order) return `${result.order.id} · ${result.order.item} · ${result.order.status}${result.order.eta ? ` · ETA ${result.order.eta}` : ''}`
  if (result.refund) return `₹${result.refund.amount.toLocaleString('en-IN')} refunded · ref ${result.refund.refundId}`
  if (result.ticket) return `${result.ticket.ticketId} · ${result.ticket.subject}`
  if (result.escalation) return `Handed to ${result.escalation.queue} · position ${result.escalation.position} in queue`
  return null
}

const TABS = [
  { id: 'trace', label: '🔬 Trace' },
  { id: 'actions', label: '📋 Actions' },
  { id: 'knowledge', label: '📚 Knowledge' }
]

export default function RightPanel({ events, actions, isThinking, onCollapse }) {
  const [tab, setTab] = useState('trace')
  // Same "stick to bottom" pattern as the chat: scroll only this container,
  // and only when the user hasn't scrolled up to read earlier trace events.
  const scrollRef = useRef(null)
  const stickToBottom = useRef(true)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  useEffect(() => {
    const el = scrollRef.current
    if (tab === 'trace' && el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }, [events, tab])

  return (
    <aside className="trace-panel glass">
      <div className="trace-header">
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
              {t.id === 'actions' && actions.length > 0 && <span className="tab-badge">{actions.length}</span>}
            </button>
          ))}
        </div>
        <button className="collapse-btn" onClick={onCollapse} title="Hide this panel">»</button>
      </div>

      <div className="trace-scroll" ref={scrollRef} onScroll={handleScroll}>
        {/* ---------------- 🔬 TRACE ---------------- */}
        {tab === 'trace' && (
          <>
            {events.length === 0 && !isThinking && (
              <div className="trace-empty">
                Send a message and watch Aura's reasoning appear here step by step —
                thoughts, knowledge retrieval, guardrails, and tool calls.
              </div>
            )}
            {events.map((event, index) => {
              const style = EVENT_STYLES[event.type] ?? { icon: '•', label: event.type }
              return (
                <div key={index} className={`trace-item ${event.type}`}>
                  <div className="trace-item-head">
                    <span>{style.icon} {style.label}</span>
                    {event.name && <code>{event.name}</code>}
                    {event.rule && <code>{event.rule}</code>}
                  </div>
                  {event.text && <div className="trace-item-body">{event.text}</div>}
                  {event.type === 'tool_result' && summarizeResult(event.result) && (
                    <div className="trace-item-body">{summarizeResult(event.result)}</div>
                  )}
                  {event.docs?.length > 0 && (
                    <ul className="trace-docs">
                      {event.docs.map(doc => (
                        <li key={doc.title}>{doc.title} <em>score {doc.score}</em></li>
                      ))}
                    </ul>
                  )}
                  {/* Raw JSON payloads are collapsed by default to keep the trace
                      readable — expandable for "under the hood" demo moments. */}
                  {(event.args || event.result) && (
                    <details className="payload">
                      <summary>{'{ }'} view JSON payload</summary>
                      {event.args && <pre>{JSON.stringify(event.args, null, 2)}</pre>}
                      {event.result && <pre>{JSON.stringify(event.result, null, 2)}</pre>}
                    </details>
                  )}
                </div>
              )
            })}
          </>
        )}

        {/* ---------------- 📋 ACTIONS ---------------- */}
        {tab === 'actions' && (
          <>
            {actions.length === 0 && (
              <div className="trace-empty">
                No actions yet. When Aura looks up orders, issues refunds, creates
                tickets, or escalates to a human, each real action is recorded here.
              </div>
            )}
            {actions.map((action, index) => (
              <div key={index} className="action-item">
                <span className="action-icon">{action.icon}</span>
                <div>
                  <div className="action-title">{action.title}</div>
                  <div className="action-meta">{action.meta}</div>
                </div>
                <span className="action-time">
                  {new Date(action.at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </>
        )}

        {/* ---------------- 📚 KNOWLEDGE ---------------- */}
        {tab === 'knowledge' && (
          <>
            <div className="kb-intro">
              The {getKnowledgeBase().length} articles Aura retrieves from (RAG). Full
              transparency: every policy answer is grounded in one of these.
            </div>
            {getKnowledgeBase().map(article => (
              <details key={article.id} className="kb-article">
                <summary>
                  <span>{article.title}</span>
                  <code>{article.id}</code>
                </summary>
                <p>{article.content}</p>
                <div className="kb-tags">
                  {article.tags.map(tag => <span key={tag} className="kb-tag">{tag}</span>)}
                </div>
              </details>
            ))}
          </>
        )}
      </div>
    </aside>
  )
}
