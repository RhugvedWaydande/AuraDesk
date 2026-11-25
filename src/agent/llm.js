// llm.js — the agent's "voice": turns facts into a natural-language reply.
// CONCEPT: This file has TWO modes:
//
//   1. LIVE mode  — if you add a free Groq API key in a `.env` file
//                   (VITE_GROQ_API_KEY=gsk_...), replies are written by a real
//                   LLM (Llama 3.1), grounded in the retrieved articles and
//                   tool results we pass in the prompt.
//   2. DEMO mode  — with no key, a template-based composer writes the reply
//                   from the same inputs. Everything else (retrieval, guardrails,
//                   tools, the agent loop) is 100% real in both modes.
//
// INTERVIEW NOTE: this separation is called "LLM abstraction" — the rest of the
// app doesn't know or care which model is behind this function. Swapping Groq
// for OpenAI/Gemini means editing ONE file.

import { getSettings } from '../settings.js'

const GROQ_KEY = import.meta.env.VITE_GROQ_API_KEY
export const hasLiveLLM = Boolean(GROQ_KEY)

/**
 * LIVE mode: ask the real LLM to write the final reply.
 * We use a strict system prompt = "prompt engineering" for reliability.
 */
async function callGroq({ userMessage, retrievedArticles, toolResults }) {
  const context = retrievedArticles
    .map(r => `ARTICLE "${r.article.title}":\n${r.article.content}`)
    .join('\n\n')
  const actions = toolResults
    .map(t => `TOOL ${t.name} returned: ${JSON.stringify(t.result)}`)
    .join('\n')

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      temperature: 0.3, // low temperature = factual, less creative — right for support
      messages: [
        {
          role: 'system',
          content:
            `You are Aura, the AI customer support agent on AuraDesk, serving ${getSettings().storeName}, an Indian electronics store. ` +
            'Answer ONLY using the knowledge-base articles and tool results provided. ' +
            'If the information is not present, say you are not sure and offer to create a ticket. ' +
            'Be warm, concise (under 120 words), and never invent policies, prices, or dates.'
        },
        {
          role: 'user',
          content: `Customer message: "${userMessage}"\n\nKnowledge base:\n${context || '(none found)'}\n\nActions taken:\n${actions || '(none)'}`
        }
      ]
    })
  })
  if (!response.ok) throw new Error(`Groq API error ${response.status}`)
  const data = await response.json()
  return data.choices[0].message.content
}

/** DEMO mode: deterministic reply composer using the same inputs. */
function composeDemoReply({ intent, retrievedArticles, toolResults }) {
  const parts = []

  for (const t of toolResults) {
    if (t.name === 'get_order_status' && t.result.ok) {
      const o = t.result.order
      parts.push(
        o.status === 'Delivered'
          ? `Good news — your order ${o.id} (${o.item}) was delivered on ${o.deliveredOn}. 📦`
          : `Your order ${o.id} (${o.item}) is currently “${o.status}” and expected by ${o.eta}. 🚚`
      )
    }
    if (t.name === 'get_order_status' && !t.result.ok) {
      parts.push(`I couldn't find that order — ${t.result.error} Could you double-check the ID? It looks like ORD-XXXX.`)
    }
    if (t.name === 'process_refund' && t.result.ok) {
      const r = t.result.refund
      parts.push(`Done! I've processed your refund of ₹${r.amount.toLocaleString('en-IN')} for ${r.orderId} (reference ${r.refundId}). It should reach your account in ${r.expected}. ✅`)
    }
    if (t.name === 'create_ticket' && t.result.ok) {
      const tk = t.result.ticket
      parts.push(`I've created ticket ${tk.ticketId} (priority: ${tk.priority}) so our team can follow up.`)
    }
    if (t.name === 'escalate_to_human' && t.result.ok) {
      const e = t.result.escalation
      parts.push(`I've connected you to our ${e.queue} team — you're number ${e.position} in the queue. A specialist will take it from here. 🧑‍💼`)
    }
  }

  // If no tool answered the question, answer from the retrieved knowledge.
  if (parts.length === 0 && retrievedArticles.length > 0) {
    const best = retrievedArticles[0].article
    parts.push(`Here's what our policy says — from “${best.title}”:\n\n${best.content}`)
    parts.push(`Does that answer your question? I can also create a ticket if you need more help.`)
  }

  if (parts.length === 0) {
    // Helpful failure: instead of a dead-end apology, tell the user exactly
    // what this agent CAN do (capability discovery > generic error messages).
    parts.push(
      `Hmm, I couldn't find anything about that in the ${getSettings().storeName} knowledge base. Here's what I'm great at:\n\n` +
      '📦 Order status — try an order ID like ORD-1001\n' +
      '💸 Refunds & returns — e.g. "I want a refund for ORD-1002"\n' +
      '📚 Policies — shipping, warranty, payments, account & password help\n' +
      '🎧 Product help — e.g. Bluetooth pairing for Nimbus headphones\n' +
      '🧑‍💼 Or say "talk to a human" and I\'ll connect you\n\n' +
      'What would you like to do?'
    )
  }

  return parts.join('\n\n')
}

/** Public entry point used by the agent loop. Picks live vs demo automatically. */
export async function generateReply(inputs) {
  if (hasLiveLLM) {
    try {
      return await callGroq(inputs)
    } catch {
      // Graceful degradation: if the API fails, fall back to demo mode
      return composeDemoReply(inputs)
    }
  }
  return composeDemoReply(inputs)
}
