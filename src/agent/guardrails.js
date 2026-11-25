// guardrails.js — safety checks that run BEFORE and AROUND the agent's actions.
// CONCEPT: Production agents can't be allowed to do anything a user asks.
// Guardrails are deterministic rules (not AI — on purpose, so they can't be
// sweet-talked) that constrain the agent. This file is a huge interview talking
// point: it shows you think about safety and failure modes, not just happy paths.

// Rule 1: block messages that contain what looks like a full card number.
// The agent should never receive or store raw payment credentials (PII safety).
const CARD_NUMBER_REGEX = /\b(?:\d[ -]?){13,19}\b/

// Rule 2: refunds above this amount must NOT be auto-processed by the AI.
// A human must approve them. This is called "human-in-the-loop".
export const REFUND_AUTO_LIMIT = 5000 // ₹

// Rule 3: keep the agent on-topic. If a message has nothing to do with
// customer support AND retrieval found nothing, politely refuse.
const OFF_TOPIC_HINTS = [
  'poem', 'joke', 'essay', 'homework', 'weather', 'cricket score', 'recipe',
  'girlfriend', 'stock tip', 'lottery', 'hack', 'jailbreak', 'ignore your instructions',
  'ignore previous', 'system prompt', 'pretend you are'
]

/** Check the user's raw input before the agent processes it. */
export function checkInput(message) {
  const lower = message.toLowerCase()

  if (CARD_NUMBER_REGEX.test(message)) {
    return {
      pass: false,
      rule: 'PII_BLOCK',
      userMessage:
        'For your security, please never share full card numbers in chat. ' +
        'I have not stored that message. For billing issues I can help without card details.'
    }
  }

  const promptInjection = OFF_TOPIC_HINTS.find(hint => lower.includes(hint))
  if (promptInjection) {
    return {
      pass: false,
      rule: 'SCOPE_BLOCK',
      userMessage:
        "I'm Nimbus Gear's support assistant, so I can only help with orders, refunds, " +
        'products and account issues. Is there something about your order I can help with?'
    }
  }

  return { pass: true }
}

/** Check whether a refund may be auto-processed or needs a human (human-in-the-loop). */
export function checkRefundAllowed(amount) {
  if (amount > REFUND_AUTO_LIMIT) {
    return {
      pass: false,
      rule: 'REFUND_LIMIT',
      reason: `Refund of ₹${amount.toLocaleString('en-IN')} exceeds the ₹${REFUND_AUTO_LIMIT.toLocaleString('en-IN')} auto-approval limit — escalating to a human specialist.`
    }
  }
  return { pass: true }
}
