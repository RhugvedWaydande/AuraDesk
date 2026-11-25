// tools.js — the agent's "hands": actions it can take in the real world.
// CONCEPT: Tool calling (a.k.a. function calling) is what separates an AGENT
// from a chatbot. A chatbot only talks; an agent looks things up and DOES things.
// Each tool below has:
//   - a name + description + parameter schema  -> this is what you'd hand to an
//     LLM's function-calling API so it knows what it's allowed to do
//   - a run() function -> the actual implementation the app executes
//
// Here the "backend" is a mock in-memory database, but the shape is identical
// to calling real APIs (Shopify, Stripe, Zendesk...).

// --- Mock company database -------------------------------------------------
export const ORDERS_DB = {
  'ORD-1001': { id: 'ORD-1001', item: 'Nimbus X1 Headphones', amount: 4499, status: 'Shipped', eta: '27 Nov 2026', deliveredOn: null },
  'ORD-1002': { id: 'ORD-1002', item: 'Nimbus Trek Backpack', amount: 2999, status: 'Delivered', eta: null, deliveredOn: '18 Nov 2026' },
  'ORD-1003': { id: 'ORD-1003', item: 'Nimbus Pro 4K Drone', amount: 54999, status: 'Delivered', eta: null, deliveredOn: '21 Nov 2026' },
  'ORD-1004': { id: 'ORD-1004', item: 'Nimbus Smartwatch S2', amount: 8999, status: 'Processing', eta: '30 Nov 2026', deliveredOn: null }
}

let ticketCounter = 5000

// --- Tool definitions ------------------------------------------------------
export const TOOLS = [
  {
    name: 'get_order_status',
    description: 'Look up the live status of a customer order by its order ID.',
    parameters: { orderId: 'string — e.g. "ORD-1001"' },
    run({ orderId }) {
      const order = ORDERS_DB[orderId.toUpperCase()]
      if (!order) return { ok: false, error: `No order found with ID ${orderId}.` }
      return { ok: true, order }
    }
  },
  {
    name: 'process_refund',
    description: 'Issue a refund for a delivered order. Only for amounts within the auto-approval limit.',
    parameters: { orderId: 'string', amount: 'number (₹)', reason: 'string' },
    run({ orderId, amount, reason }) {
      const order = ORDERS_DB[orderId.toUpperCase()]
      if (!order) return { ok: false, error: `No order found with ID ${orderId}.` }
      return {
        ok: true,
        refund: {
          refundId: 'REF-' + Math.floor(1000 + Math.random() * 9000),
          orderId: order.id,
          amount,
          reason,
          expected: '3-5 business days'
        }
      }
    }
  },
  {
    name: 'create_ticket',
    description: 'Create a support ticket for issues that need tracking or human follow-up.',
    parameters: { subject: 'string', priority: '"low" | "normal" | "high"', details: 'string' },
    run({ subject, priority, details }) {
      ticketCounter += 1
      return {
        ok: true,
        ticket: { ticketId: 'TKT-' + ticketCounter, subject, priority, details, status: 'Open' }
      }
    }
  },
  {
    name: 'escalate_to_human',
    description: 'Hand the conversation to a human specialist when the agent is not confident or policy requires it.',
    parameters: { reason: 'string', summary: 'string' },
    run({ reason, summary }) {
      return {
        ok: true,
        escalation: { queue: 'Specialist Support', position: Math.floor(1 + Math.random() * 4), reason, summary }
      }
    }
  }
]

/** Find a tool by name and execute it — the agent loop calls this. */
export function executeTool(name, args) {
  const tool = TOOLS.find(t => t.name === name)
  if (!tool) return { ok: false, error: `Unknown tool: ${name}` }
  return tool.run(args)
}
