# 🗺️ Code Tour — Your Interview Cheat-Sheet

Read this top-to-bottom once and you'll be able to explain every line of this project.

---

## The 30-second elevator pitch

> "I built **AuraDesk** — an AI customer-support **agent** named Aura, not a chatbot. When a customer sends a message, it runs guardrails, classifies intent, retrieves relevant policy articles (RAG), calls tools like order lookup and refund processing, and escalates to a human when policy requires it. The UI shows a live trace of every internal step, because observability is what makes agents production-ready."

---

## How a message flows through the system

```
User types message
      │
      ▼
App.jsx (handleSend)          ← React state owner
      │
      ▼
agent.js (runAgent)           ← THE AGENT LOOP ⭐
      │
      ├─ 1. guardrails.js  → checkInput()        "Is this safe & on-topic?"
      ├─ 2. classifyIntent()                     "What does the user want?"
      ├─ 3. retriever.js   → retrieve()          "What does company policy say?" (RAG)
      ├─ 4. tools.js       → executeTool()       "Take real actions"
      │        └─ guardrails.js → checkRefundAllowed()   (human-in-the-loop)
      └─ 5. llm.js         → generateReply()     "Write the final answer"
      │
      ▼
Reply bubble appears in chat; every step appeared live in TracePanel
```

---

## File-by-file: what it does & why it exists

### `src/agent/agent.js` — the agent loop ⭐ (know this one cold)
Orchestrates the whole pipeline: **perceive → think → act → respond**. It calls
guardrails first, then intent classification, then retrieval, then tools, then
reply generation. Every step `emit()`s a trace event to the UI.
**Key line to mention:** the refund branch — it checks `checkRefundAllowed()`
BEFORE calling `process_refund`, and if the amount is too high it creates a
ticket and escalates instead. That's policy-enforced human-in-the-loop.

### `src/agent/retriever.js` — RAG retrieval
A mini search engine: tokenizes the question, strips stop-words, scores each
knowledge article (+3 for tag match, +1 for body match), returns top-3.
**Expected interview question:** *"Why keyword search and not embeddings?"*
**Answer:** "The pipeline shape — query → rank → top-k → feed to the generator —
is identical to a vector-DB setup. I used lexical scoring so the ranking is
fully transparent and debuggable; swapping in embeddings + cosine similarity
only changes the scoring function, and I'd do that for fuzzy/semantic queries."

### `src/agent/knowledgeBase.js` — the knowledge
Six policy articles (shipping, refunds, warranty, …) with tags. In production
this would be chunks of real docs stored as embeddings in a vector DB
(Pinecone/Chroma/pgvector).

### `src/agent/tools.js` — tool/function calling
Four tools: `get_order_status`, `process_refund`, `create_ticket`,
`escalate_to_human`. Each has a **name, description, and parameter schema** —
exactly the format LLM function-calling APIs expect — plus a `run()`
implementation against a mock orders database.
**Talking point:** "Tools are what turn a chatbot into an agent: it doesn't just
say a refund will happen, it executes the refund and returns a reference ID."

### `src/agent/guardrails.js` — safety layer
Three deterministic rules: (1) block card numbers (PII), (2) refunds over
₹5,000 require a human, (3) block off-topic / prompt-injection attempts like
"ignore your instructions".
**Talking point:** "Guardrails are deliberately plain code, not AI — a rule that
can't be sweet-talked. The LLM never even sees a blocked message."

### `src/agent/llm.js` — reply generation (LLM abstraction)
One function, `generateReply()`, with two implementations: a real Groq/Llama
call (if `VITE_GROQ_API_KEY` exists) and a deterministic demo composer. Both
consume the same inputs: user message + retrieved articles + tool results.
**Talking points:** low `temperature: 0.3` for factual answers; the system
prompt forbids answering outside the provided context (anti-hallucination);
if the API fails it gracefully degrades to the composer instead of crashing.

### `src/App.jsx` — React state owner
Holds `messages`, `traceEvents`, `isThinking`. Demonstrates one-way data flow:
state lives at the top, flows down as props, events bubble up via callbacks.

### `src/components/ChatPanel.jsx` — chat UI
Welcome hero with one-click demo cards, message bubbles with timestamps,
typewriter effect on new replies (simulates LLM token streaming — one
`setTimeout` revealing 3 characters per tick), 👍/👎 feedback buttons, typing
indicator, input form. Shows optimistic UI (user bubble renders before the
agent finishes) and auto-scroll via `useRef` + `useEffect`.
**Talking point on feedback:** "Every reply collects thumbs up/down — that's
the labelled data an evaluation pipeline needs, which is my next project."

### `src/components/RightPanel.jsx` — observability UI (3 tabs)
🔬 **Trace** renders the emitted trace events with per-type colors and JSON
payloads — a mini LangSmith. **Demo centerpiece:** trigger the ₹54,999 refund
and narrate the trace as the guardrail trips and escalation happens.
📋 **Actions** is a cumulative log of real side effects (orders looked up,
refunds, tickets, escalations) — proof it's an agent, not a chatbot.
📚 **Knowledge** lets anyone browse the RAG source articles — transparency
about exactly what grounds the agent's answers.

### `src/settings.js` — configurable branding
A tiny persistence module: the store name lives in `localStorage` behind
`getSettings()/saveSettings()`. The header, welcome hero, and the LLM system
prompt all read from it — change it once (⚙️ in the header) and the whole
product rebrands. **Talking point:** same abstraction idea as `llm.js` — one
module owns storage, so swapping localStorage for a real backend API later
touches exactly one file.

### `src/components/Logo.jsx` — Aura's identity
The gradient-orb logo as inline SVG (crisp at any size, zero image assets),
with an optional CSS "pulse ring" to show the agent is online.

### Three more UX decisions worth defending in interviews
**Dark/light theming:** the whole palette lives in CSS variables on `:root`;
light mode is one `data-theme="light"` attribute on `<html>` that swaps the
variables — near-zero duplicated CSS. **Collapsible trace panel:** the trace
viewer is for technical viewers; end users can hide it (one boolean state in
App, grid collapses to one column). **Capability discovery:** the "?" help box
lists clickable example prompts, and when retrieval finds nothing the agent
replies with what it CAN do instead of a dead-end apology. Scoped-but-helpful
is exactly how production support agents behave.

### UI theme (`styles.css`) — two techniques worth naming
**Aurora background:** four huge blurred radial gradients on a fixed
`body::before` layer, drifting via one CSS keyframe animation — GPU-cheap,
zero JavaScript. **Glassmorphism:** translucent panels with
`backdrop-filter: blur()` so the aurora glows through every surface.

### `vite.config.js`, `index.html`, `src/main.jsx`
Standard Vite + React plumbing: dev server config, the single HTML page, and
mounting `<App />` into `#root`.

---

## A real bug story worth telling in interviews 🐛

While building this, the app once rendered a completely blank page. The lesson:

- **The bug:** `useEffect(scrollToBottom, [messages])` where `scrollToBottom`
  was an arrow function with an implicit return. React treats anything a
  useEffect returns as a *cleanup function* and calls it on the next render —
  it wasn't a function, so React crashed and unmounted the whole app.
- **Why it was sneaky:** the build passed, the server returned 200s, and even
  server-side rendering worked (effects don't run in SSR). Only a real browser
  with the console open revealed it.
- **The fix:** wrap the call in braces so the effect returns nothing:
  `useEffect(() => { scrollToBottom() }, [messages])`.
- **The takeaway line:** "Blank page + server says 200 = the problem is in the
  browser, so I reproduced it in a headless browser and read the console."

---

## Questions interviewers will ask (and your answers)

**"What makes this 'agentic' rather than a chatbot?"**
It perceives, plans (intent + retrieval), acts through tools with real side
effects, and knows its own limits (escalates to humans). A chatbot only maps
text to text.

**"How do you prevent hallucinations?"**
Three layers: retrieval grounds answers in real policy text; the system prompt
forbids answering beyond provided context; and anything retrieval can't support
becomes "I'm not sure" + a ticket instead of a guess.

**"What would you change for production?"**
Move the LLM call behind a backend (hide the API key), swap keyword retrieval
for embeddings in a vector DB, persist tickets/refunds in a real database, add
auth, rate limiting, and automated evals — which is exactly what my second
portfolio project (the Agent Evaluation Dashboard) addresses.

**"Why rule-based intent classification?"**
Deterministic, zero-latency, zero-cost, and easy to test. In production I'd use
the LLM's function-calling to choose tools, with these rules kept as a fallback
and sanity check.
