// TF-IDF (Term Frequency - Inverse Document Frequency) module
// Implements a client-side text similarity algorithm as both a fallback
// when the NLP backend is unavailable and a secondary scoring signal

// Common English stopwords to filter out during tokenization
const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "dare",
  "it", "its", "this", "that", "these", "those", "i", "me", "my", "we",
  "our", "you", "your", "he", "him", "his", "she", "her", "they", "them",
  "their", "what", "which", "who", "whom", "where", "when", "how", "why",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very", "just",
  "about", "above", "after", "again", "all", "also", "am", "any", "as",
  "because", "before", "between", "both", "each", "few", "more", "most",
  "other", "over", "same", "some", "such", "through", "under", "until",
  "up", "while"
]);

// ── Tokenization ──

export function tokenize(text) {
  // Convert to lowercase, split on non-alphabetic characters, remove stopwords
  return text
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
}

// ── Term Frequency ──

export function computeTF(tokens) {
  // Build a frequency map: how often each word appears relative to total words
  const freqMap = new Map();
  const total = tokens.length;

  if (total === 0) return freqMap;

  for (const token of tokens) {
    freqMap.set(token, (freqMap.get(token) || 0) + 1);
  }

  // Normalize by total token count
  for (const [word, count] of freqMap) {
    freqMap.set(word, count / total);
  }

  return freqMap;
}

// ── Inverse Document Frequency ──

export function computeIDF(corpus) {
  // For each unique word across all documents, compute log(N / df)
  // where df = number of documents containing that word
  const N = corpus.length;
  const docFreq = new Map();

  for (const doc of corpus) {
    // Use a Set to count each word only once per document
    const uniqueWords = new Set(doc);
    for (const word of uniqueWords) {
      docFreq.set(word, (docFreq.get(word) || 0) + 1);
    }
  }

  const idfMap = new Map();
  for (const [word, df] of docFreq) {
    idfMap.set(word, Math.log(N / df));
  }

  return idfMap;
}

// ── Cosine Similarity ──

export function cosineSimilarity(vecA, vecB) {
  // Compute dot product and magnitudes for cosine similarity
  // cosine = (A · B) / (|A| × |B|)
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  // Collect all unique dimensions from both vectors
  const allKeys = new Set([...vecA.keys(), ...vecB.keys()]);

  for (const key of allKeys) {
    const a = vecA.get(key) || 0;
    const b = vecB.get(key) || 0;
    dotProduct += a * b;
    magnitudeA += a * a;
    magnitudeB += b * b;
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  // Avoid division by zero
  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
}

// ── Build TF-IDF Vector ──

function buildTFIDFVector(tokens, idfMap) {
  // Multiply each term's TF by its IDF to get the TF-IDF weight
  const tf = computeTF(tokens);
  const tfidfVec = new Map();

  for (const [word, tfVal] of tf) {
    const idf = idfMap.get(word) || 0;
    tfidfVec.set(word, tfVal * idf);
  }

  return tfidfVec;
}

// ── Corpus Index (precomputed at load time) ──

export function buildCorpusIndex(charities) {
  // Tokenize all missions once and precompute the IDF map
  const tokenizedMissions = charities.map(c => tokenize(c.mission));
  const idfMap = computeIDF(tokenizedMissions);
  return { tokenizedMissions, idfMap };
}

// ── Score a query against a single mission ──

export function tfidfScore(queryTokens, missionTokens, idfMap) {
  const queryVec = buildTFIDFVector(queryTokens, idfMap);
  const missionVec = buildTFIDFVector(missionTokens, idfMap);
  return cosineSimilarity(queryVec, missionVec);
}

// ── Score a weighted query against all missions ──

export function tfidfBatchScore(weightedKeywords, corpusIndex) {
  // Compute weighted TF-IDF similarity for each charity mission
  // Each keyword is scored individually then combined using position weights
  const { tokenizedMissions, idfMap } = corpusIndex;
  const totalWeight = weightedKeywords.reduce((sum, k) => sum + k.weight, 0);

  if (totalWeight === 0) return tokenizedMissions.map(() => 0);

  return tokenizedMissions.map(missionTokens => {
    let weightedSum = 0;

    for (const kw of weightedKeywords) {
      const queryTokens = tokenize(kw.word);
      const score = tfidfScore(queryTokens, missionTokens, idfMap);
      weightedSum += kw.weight * score;
    }

    return weightedSum / totalWeight;
  });
}
