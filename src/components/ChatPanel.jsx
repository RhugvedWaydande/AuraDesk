// ChatPanel.jsx — the left panel: welcome hero (first impression!), chat
// bubbles with timestamps, typewriter effect on new agent replies, 👍/👎
// feedback buttons, typing indicator, and the input composer.
import { useState, useRef, useEffect } from 'react'
import Logo from './Logo.jsx'

// The four "What can I do?" cards on the welcome hero. Clicking one sends
// the prompt immediately — a one-click demo for recruiters.
const HERO_CARDS = [
  { icon: '📦', title: 'Track an order', desc: 'Live status & delivery dates', prompt: 'Where is my order ORD-1001?' },
  { icon: '💸', title: 'Get a refund', desc: 'Instant if within policy', prompt: 'I want a refund for ORD-1002' },
  { icon: '📚', title: 'Policy questions', desc: 'Returns, warranty, payments', prompt: 'What is your return policy?' },
  { icon: '🧑‍💼', title: 'Talk to a human', desc: 'Aura knows when to hand off', prompt: 'Let me talk to a human' }
]

// Everything Aura can answer, grouped — shown in the "What can I ask?" box.
// Every item is clickable and sends immediately (capability discovery:
// never leave users guessing what an AI agent can do).
const HELP_TOPICS = [
  { group: '📦 Orders', items: ['Where is my order ORD-1001?', 'Track my order ORD-1004'] },
  { group: '💸 Refunds', items: ['I want a refund for ORD-1002', 'I want a refund for ORD-1003 (watch the guardrail!)'] },
  { group: '📚 Policies & account', items: ['What is your return policy?', 'How long does shipping take?', 'Is there a warranty?', 'How do I reset my password?', 'What payment methods do you accept?'] },
  { group: '🎧 Products', items: ["My headphones won't pair over Bluetooth", 'How long does the battery last?'] },
  { group: '🧑‍💼 Human help', items: ['Let me talk to a human'] }
]

/** Renders agent text with a typewriter animation (simulates LLM token
 *  streaming). Runs once per message — old messages render instantly. */
function Typewriter({ text, onTick }) {
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (shown >= text.length) return
    const timer = setTimeout(() => {
      setShown(count => Math.min(count + 3, text.length)) // reveal 3 chars per tick
      onTick?.() // let the parent auto-scroll as the bubble grows
    }, 14)
    return () => clearTimeout(timer)
  }, [shown, text, onTick])
  return <>{text.slice(0, shown)}</>
}

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

export default function ChatPanel({ messages, isThinking, feedback, storeName, onFeedback, onSend }) {
  const [draft, setDraft] = useState('')
  const [showHelp, setShowHelp] = useState(false)
  const textareaRef = useRef(null)

  /** Auto-grow: height follows the content, capped at ~4 lines (CSS max-height). */
  function autoGrow() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'              // reset so shrinking works too
    el.style.height = el.scrollHeight + 'px'
  }

  /** Shared send logic for both the button and the Enter key. */
  function send() {
    if (!draft.trim() || isThinking) return
    onSend(draft)
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  /** Enter sends; Shift+Enter inserts a newline (the convention users expect). */
  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      send()
    }
  }

  /** Clicking a help example sends it and closes the box. */
  function sendExample(text) {
    setShowHelp(false)
    onSend(text.replace(' (watch the guardrail!)', '')) // strip the demo hint
  }
  // "STICK TO BOTTOM" scrolling (the pattern every chat app uses):
  // - We scroll ONLY the chat container (el.scrollTop), never scrollIntoView —
  //   scrollIntoView scrolls every ancestor, including the whole page!
  // - We follow new messages ONLY if the user is already at the bottom.
  //   The moment they scroll up to read, stickToBottom flips false and we
  //   stop touching their scroll position entirely.
  const scrollRef = useRef(null)
  const stickToBottom = useRef(true) // ref, not state: changing it must not re-render

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    // within 80px of the bottom counts as "at the bottom"
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  const followBottom = () => {
    const el = scrollRef.current
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight
  }

  // NOTE: the braces matter! useEffect treats a returned value as a "cleanup
  // function" — so the effect callback must return nothing (see CODE_TOUR.md).
  useEffect(() => { followBottom() }, [messages, isThinking])

  function submit(event) {
    event.preventDefault()
    send()
  }

  return (
    <section className="chat-panel glass">
      <div className="chat-scroll" ref={scrollRef} onScroll={handleScroll}>
        {/* ---------- Welcome hero (shown until the first message) ---------- */}
        {messages.length === 0 && (
          <div className="hero">
            <Logo size={64} pulse />
            <h1>Hi, I'm <span className="grad-text">Aura</span> 👋</h1>
            <p>
              Your AI support agent for {storeName}. I don't just chat — I look up
              orders, process refunds, and know when to bring in a human.
            </p>
            <div className="hero-cards">
              {HERO_CARDS.map(card => (
                <button key={card.title} className="hero-card" onClick={() => onSend(card.prompt)}>
                  <span className="hero-card-icon">{card.icon}</span>
                  <span className="hero-card-title">{card.title}</span>
                  <span className="hero-card-desc">{card.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ---------- Chat history ---------- */}
        {messages.map(message => (
          <div key={message.id} className={`bubble-row ${message.role}`}>
            <div className="avatar">
              {message.role === 'agent' ? <Logo size={30} /> : <span className="user-avatar">🧑</span>}
            </div>
            <div className="bubble-stack">
              <div className="bubble">
                {message.role === 'agent' && message.animate
                  ? <Typewriter text={message.text} onTick={followBottom} />
                  : message.text}
              </div>
              <div className="bubble-meta">
                <span className="timestamp">{formatTime(message.at)}</span>
                {message.role === 'agent' && (
                  <span className="feedback">
                    <button
                      className={feedback[message.id] === 'up' ? 'active' : ''}
                      onClick={() => onFeedback(message.id, 'up')}
                      title="Good answer"
                    >👍</button>
                    <button
                      className={feedback[message.id] === 'down' ? 'active' : ''}
                      onClick={() => onFeedback(message.id, 'down')}
                      title="Bad answer"
                    >👎</button>
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isThinking && (
          <div className="bubble-row agent">
            <div className="avatar"><Logo size={30} pulse /></div>
            <div className="bubble typing"><span /><span /><span /></div>
          </div>
        )}
      </div>

      {/* "What can I ask?" — capability discovery box above the composer */}
      {showHelp && (
        <div className="help-box">
          <div className="help-box-head">
            <strong>💡 Things you can ask Aura</strong>
            <button type="button" onClick={() => setShowHelp(false)} title="Close">✕</button>
          </div>
          <div className="help-groups">
            {HELP_TOPICS.map(topic => (
              <div key={topic.group} className="help-group">
                <span className="help-group-title">{topic.group}</span>
                {topic.items.map(item => (
                  <button key={item} type="button" className="help-item" disabled={isThinking} onClick={() => sendExample(item)}>
                    {item}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <form className="composer" onSubmit={submit}>
        <button
          type="button"
          className={`help-toggle ${showHelp ? 'active' : ''}`}
          onClick={() => setShowHelp(open => !open)}
          title="What can I ask?"
        >?</button>
        <textarea
          ref={textareaRef}
          value={draft}
          rows={1}
          onChange={event => { setDraft(event.target.value); autoGrow() }}
          onKeyDown={handleKeyDown}
          placeholder="Message Aura — Enter to send, Shift+Enter for a new line…"
          disabled={isThinking}
        />
        <button type="submit" disabled={isThinking || !draft.trim()}>Send ↑</button>
      </form>
    </section>
  )
}
