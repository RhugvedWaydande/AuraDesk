// knowledgeBase.js — the company's "documentation" that the agent answers from.
// CONCEPT: This is the "knowledge" half of RAG (Retrieval-Augmented Generation).
// In a real production system these articles would live in a vector database
// (Pinecone, Chroma, pgvector) as embeddings. Here they're a simple array so
// the retrieval logic in retriever.js is easy to read and explain.

// Articles may contain the {{store}} placeholder — it's replaced with the
// user-configured store name at read time (template interpolation), so a
// rename in ⚙️ settings flows through to the agent's policy answers too.
// (Product names like "Nimbus X1" stay fixed: renaming a store doesn't
// rename its product catalog.)
import { getSettings } from '../settings.js'

const ARTICLES = [
  {
    id: 'kb-001',
    title: 'Shipping & Delivery Policy',
    tags: ['shipping', 'delivery', 'order', 'track', 'tracking', 'arrive', 'late', 'eta'],
    content:
      'Standard shipping takes 3-5 business days within India. Express shipping (₹199 extra) takes 1-2 business days. ' +
      'You can track any order with its order ID (format: ORD-XXXX). If an order is more than 7 days late, ' +
      'customers are entitled to a full shipping-fee refund.'
  },
  {
    id: 'kb-002',
    title: 'Returns & Refund Policy',
    tags: ['refund', 'return', 'money', 'back', 'cancel', 'exchange', 'replace'],
    content:
      'Products can be returned within 30 days of delivery for a full refund. Items must be unused and in original packaging. ' +
      'Refunds under ₹5,000 are processed automatically within 3-5 business days. Refunds OVER ₹5,000 require human approval ' +
      'and are escalated to a support specialist. Sale items are final and non-refundable.'
  },
  {
    id: 'kb-003',
    title: 'Warranty Coverage',
    tags: ['warranty', 'broken', 'defect', 'damaged', 'repair', 'faulty', 'not working'],
    content:
      'All {{store}} products carry a 1-year manufacturer warranty covering defects in materials and workmanship. ' +
      'Physical damage, water damage, and normal wear are not covered. To claim warranty, a support ticket must be created ' +
      'with the order ID and a description of the defect.'
  },
  {
    id: 'kb-004',
    title: 'Account & Password Help',
    tags: ['password', 'account', 'login', 'reset', 'email', 'locked', 'sign in'],
    content:
      'To reset your password, click "Forgot password" on the login page and follow the email link (valid for 30 minutes). ' +
      'Accounts are locked after 5 failed attempts and unlock automatically after 1 hour. ' +
      'We will NEVER ask for your password over chat or email.'
  },
  {
    id: 'kb-005',
    title: 'Payment Methods & Billing',
    tags: ['payment', 'pay', 'card', 'upi', 'billing', 'invoice', 'charged', 'emi'],
    content:
      'We accept UPI, all major credit/debit cards, net banking, and EMI on orders above ₹10,000. ' +
      'Invoices are emailed within 24 hours of purchase and are also available under Account > Orders. ' +
      'If you were double-charged, the duplicate amount is auto-reversed within 5-7 business days.'
  },
  {
    id: 'kb-006',
    title: 'Product Care — Nimbus Headphones',
    tags: ['headphones', 'clean', 'battery', 'charge', 'pairing', 'bluetooth', 'audio'],
    content:
      'Nimbus X1 headphones: 40-hour battery life, full charge in 90 minutes via USB-C. ' +
      'For pairing issues, hold the power button 8 seconds to factory-reset Bluetooth. ' +
      'Clean ear cushions with a dry microfiber cloth only — liquids void the warranty.'
  }
]

/** Returns the knowledge base with {{store}} placeholders filled in with the
 *  CURRENT store name — called fresh on every retrieval, so a rename in
 *  settings applies to the very next question. */
export function getKnowledgeBase() {
  const storeName = getSettings().storeName
  return ARTICLES.map(article => ({
    ...article,
    content: article.content.replaceAll('{{store}}', storeName)
  }))
}

// Kept for backwards compatibility anywhere a static list is fine.
export const KNOWLEDGE_BASE = ARTICLES
