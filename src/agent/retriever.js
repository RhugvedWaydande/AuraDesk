// retriever.js — the "R" in RAG: Retrieval.
// CONCEPT: Before the agent answers, it SEARCHES the knowledge base for the most
// relevant articles and feeds them to the answer generator. This "grounds" the
// agent in real company policy instead of letting it make things up (hallucinate).
//
// This implementation uses keyword/lexical scoring (like a mini search engine).
// INTERVIEW NOTE: in production you'd use *semantic* search instead — convert text
// to embedding vectors and rank by cosine similarity — but the pipeline shape
// (query -> rank -> top-k -> feed to LLM) is exactly the same. Being able to
// explain that tradeoff is a great interview moment.

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'i', 'my', 'me', 'to', 'of', 'for', 'and',
  'or', 'in', 'on', 'it', 'this', 'that', 'do', 'does', 'can', 'you', 'your', 'how',
  'what', 'when', 'where', 'please', 'help', 'with', 'about', 'have', 'has', 'want'
])

/** Break a sentence into meaningful lowercase words (tokenization). */
export function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')  // strip punctuation
    .split(/\s+/)
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
}

/**
 * Score every article against the user's question and return the top matches.
 * Scoring: +3 if a query word is one of the article's tags (strong signal),
 *          +1 if it appears anywhere in the article body or title.
 */
export function retrieve(query, knowledgeBase, topK = 3) {
  const queryWords = tokenize(query)

  const scored = knowledgeBase.map(article => {
    const haystack = (article.title + ' ' + article.content).toLowerCase()
    let score = 0
    for (const word of queryWords) {
      if (article.tags.some(tag => tag.includes(word) || word.includes(tag))) score += 3
      if (haystack.includes(word)) score += 1
    }
    return { article, score }
  })

  return scored
    .filter(result => result.score > 0)       // drop irrelevant articles
    .sort((a, b) => b.score - a.score)        // best first
    .slice(0, topK)                            // keep only top-k (context is expensive!)
}
