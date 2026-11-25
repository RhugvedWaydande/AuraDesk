// agent.js — THE AGENT LOOP. This is the heart of the whole project. ⭐
// CONCEPT: An agent follows a loop:  PERCEIVE -> THINK -> ACT -> RESPOND.
//   1. PERCEIVE  — read the user's message, run guardrails on it
//   2. THINK     — classify what the user wants (intent) + retrieve knowledge (RAG)
//   3. ACT       — call tools (check orders, refund, ticket, escalate), with
//                  guardrails deciding when a HUMAN must step in instead
//   4. RESPOND   — generate the final grounded reply (LLM or demo composer)
//
// Every step `emit()`s a trace event, which the UI renders live in the
// "Agent Trace" panel — that transparency/observability is a big portfolio flex.

import { getKnowledgeBase } from './knowledgeBase.js'
import { retrieve } from './retriever.js'
import { checkInput, checkRefundAllowed } from './guardrails.js'
import { executeTool, ORDERS_DB } from './tools.js'
import { generateReply } from './llm.js'

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

/** STEP "THINK": rule-based intent classification.
 *  (In live-LLM setups you might let the model classify — rules are used here
 *  so the decision logic is transparent and easy to defend in an interview.) */
function classifyIntent(message) {
  const lower = message.toLowerCase()
  const orderIdMatch = message.toUpperCase().match(/ORD-\d{3,6}/)

  if (/(refund|money back|return .*(order|item|it)|cancel my order)/.test(lower))
    return { intent: 'refund_request', orderId: orderIdMatch?.[0] ?? null }
  if (/(human|agent|person|representative|someone real|talk to support)/.test(lower))
    return { intent: 'human_request', orderId: orderIdMatch?.[0] ?? null }
  if (orderIdMatch || /(where.*order|order status|track|delivery|shipped|arrive)/.test(lower))
    return { intent: 'order_status', orderId: orderIdMatch?.[0] ?? null }
  return { intent: 'general_question', orderId: orderIdMatch?.[0] ?? null }
}

/**
 * Run the full agent pipeline for one user message.
 * @param {string} userMessage - what the customer typed
 * @param {function} emit - callback that receives trace events for the UI
 * @returns {string} the agent's final reply
 */
export async function runAgent(userMessage, emit) {
  const toolResults = []

  // ---- 1. PERCEIVE + guardrails -------------------------------------------
  emit({ type: 'thought', text: 'New message received. Running input guardrails…' })
  await sleep(350)

  const inputCheck = checkInput(userMessage)
  if (!inputCheck.pass) {
    emit({ type: 'guardrail', rule: inputCheck.rule, text: `Blocked by guardrail: ${inputCheck.rule}` })
    await sleep(300)
    emit({ type: 'response', text: 'Replying with a safe, scripted message (no LLM involved).' })
    return inputCheck.userMessage
  }
  emit({ type: 'guardrail', rule: 'PASS', text: 'Guardrails passed — message is safe and on-topic.' })
  await sleep(300)

  // ---- 2. THINK: intent + retrieval (RAG) ----------------------------------
  const { intent, orderId } = classifyIntent(userMessage)
  emit({ type: 'thought', text: `Intent classified as "${intent}"${orderId ? ` with order ID ${orderId}` : ''}.` })
  await sleep(350)

  const retrieved = retrieve(userMessage, getKnowledgeBase())
  emit({
    type: 'retrieval',
    text: retrieved.length
      ? `Retrieved ${retrieved.length} knowledge article(s).`
      : 'No relevant knowledge articles found.',
    docs: retrieved.map(r => ({ title: r.article.title, score: r.score }))
  })
  await sleep(400)

  // ---- 3. ACT: tool calls, with policy guardrails ---------------------------
  if (intent === 'order_status' && orderId) {
    emit({ type: 'tool_call', name: 'get_order_status', args: { orderId } })
    await sleep(500)
    const result = executeTool('get_order_status', { orderId })
    toolResults.push({ name: 'get_order_status', result })
    emit({ type: 'tool_result', name: 'get_order_status', result })
    await sleep(350)
  }

  if (intent === 'refund_request') {
    if (!orderId) {
      emit({ type: 'thought', text: 'Refund requested but no order ID given — will ask the customer for it.' })
      return 'I can definitely help with a refund! Could you share your order ID (it looks like ORD-XXXX) so I can pull up the details?'
    }
    const order = ORDERS_DB[orderId]
    if (order) {
      const refundCheck = checkRefundAllowed(order.amount)
      if (refundCheck.pass) {
        emit({ type: 'tool_call', name: 'process_refund', args: { orderId, amount: order.amount, reason: 'Customer request' } })
        await sleep(600)
        const result = executeTool('process_refund', { orderId, amount: order.amount, reason: 'Customer request' })
        toolResults.push({ name: 'process_refund', result })
        emit({ type: 'tool_result', name: 'process_refund', result })
      } else {
        // HUMAN-IN-THE-LOOP: policy says the AI must not approve this alone.
        emit({ type: 'guardrail', rule: refundCheck.rule, text: refundCheck.reason })
        await sleep(400)
        emit({ type: 'tool_call', name: 'create_ticket', args: { subject: `Refund approval: ${orderId}`, priority: 'high' } })
        await sleep(500)
        const ticket = executeTool('create_ticket', {
          subject: `Refund approval needed: ${orderId} (₹${order.amount.toLocaleString('en-IN')})`,
          priority: 'high',
          details: `Customer requested refund above auto-approval limit. ${refundCheck.reason}`
        })
        toolResults.push({ name: 'create_ticket', result: ticket })
        emit({ type: 'tool_result', name: 'create_ticket', result: ticket })
        await sleep(350)
        const escalation = executeTool('escalate_to_human', { reason: refundCheck.rule, summary: `High-value refund for ${orderId}` })
        toolResults.push({ name: 'escalate_to_human', result: escalation })
        emit({ type: 'tool_result', name: 'escalate_to_human', result: escalation })
      }
    } else {
      emit({ type: 'tool_call', name: 'get_order_status', args: { orderId } })
      await sleep(400)
      const result = executeTool('get_order_status', { orderId })
      toolResults.push({ name: 'get_order_status', result })
      emit({ type: 'tool_result', name: 'get_order_status', result })
    }
  }

  if (intent === 'human_request') {
    emit({ type: 'tool_call', name: 'escalate_to_human', args: { reason: 'Customer asked for a human' } })
    await sleep(500)
    const result = executeTool('escalate_to_human', { reason: 'Customer asked for a human', summary: userMessage.slice(0, 120) })
    toolResults.push({ name: 'escalate_to_human', result })
    emit({ type: 'tool_result', name: 'escalate_to_human', result })
  }

  // ---- 4. RESPOND: grounded generation --------------------------------------
  emit({ type: 'thought', text: 'Composing final reply grounded in retrieved knowledge and tool results…' })
  await sleep(450)
  const reply = await generateReply({ userMessage, intent, retrievedArticles: retrieved, toolResults })
  emit({ type: 'response', text: 'Reply generated and sent to customer.' })
  return reply
}
