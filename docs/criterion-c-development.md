# Criterion C: Development

## Techniques Used

| Technique | Location | Purpose |
|---|---|---|
| TF-IDF algorithm (tokenisation, TF, IDF, cosine similarity) | `tfidf.js` | Client-side text similarity scoring and fallback |
| Weighted average algorithm | `nlp_server.py`, `tfidf.js` | Combining per-keyword scores using ranking position |
| Levenshtein edit distance (dynamic programming) | `search.js` | Fuzzy charity search with typo tolerance |
| Sentence-transformer semantic similarity | `nlp_server.py` via HF API | Deep NLP meaning comparison |
| Hybrid scoring with graceful degradation | `home.js` | 70/30 NLP/TF-IDF blend; TF-IDF fallback if API fails |
| Batch API optimisation | `nlp_server.py`, `home.js` | Reducing 100 network requests to 1 |
| Hash maps (Map, Set) | `tfidf.js`, `search.js` | O(1) frequency counting, IDF lookup, stopword filtering |
| Firebase Auth / Firestore CRUD | `home.js`, `saved.js`, `login.js` | Authentication, per-user data with duplicate detection |
| Debounced input / AbortController timeout | `home.js` | Performance and error handling |
| Drag-and-drop DOM reordering | `home.js` | User ranking interface |
| Paginated results with sliding window | `home.js` | Displaying 10 results at a time |

---

## 1. Weighted Similarity Scoring

The application's core function is matching users with charities based on ranked personal values. Users enter values like "education" and "environment," then drag them into priority order. For the ranking to be meaningful, position must directly affect scores — a user who ranks "education" first should see education-focused charities scored higher than someone who ranked it last.

Each keyword receives a position-based weight: if ranked ["education", "health", "environment"], the weights are [3, 2, 1]. A purely weighted average of individual keyword scores would preserve ranking perfectly, but in practice it produces low match percentages because keywords that do not relate to a given charity's mission drag the average down. Conversely, concatenating all keywords into a single string produces higher scores but ignores ranking entirely. I solved this with a hybrid approach that blends both methods:

```python
def weighted_similarity_single(keywords, mission):
    if not keywords or not mission:
        return 0.0
    combined_text = " ".join(k["word"] for k in keywords)
    base_scores = get_similarity(combined_text, [mission])
    base = float(base_scores[0]) if isinstance(base_scores, list) and len(base_scores) > 0 else 0.0

    total_weight = sum(k["weight"] for k in keywords)
    weighted_sum = 0.0
    for kw in keywords:
        kw_scores = get_similarity(kw["word"], [mission])
        score = float(kw_scores[0]) if isinstance(kw_scores, list) and len(kw_scores) > 0 else 0.0
        weighted_sum += kw["weight"] * score
    weighted_avg = weighted_sum / total_weight if total_weight > 0 else 0.0

    return 0.60 * base + 0.40 * weighted_avg
```

The final score is `0.60 * combined + 0.40 * weighted_avg`, where `weighted_avg = sum(w_i x s_i) / sum(w_i)`. The 60% combined component keeps scores visibly high because the sentence-transformer encodes all keywords together into a single semantic representation. The 40% weighted individual component ensures that ranking position proportionally affects results — with weights [3, 2, 1], education contributes 3x more than environment to the individual component. I chose the 60/40 split after testing showed it produced match percentages that are both meaningfully different across ranking orders and high enough to be useful to the user. The edge case of zero total weight is handled by returning 0.0 to prevent division by zero.

---

## 2. TF-IDF Algorithm (Client-Side Implementation)

The application relies on an external NLP API hosted on Render. If the API is down or cold-starting, the app would show no results. Additionally, semantic similarity can miss exact keyword matches because the model focuses on overall meaning. To solve both problems, I implemented TF-IDF from scratch in `tfidf.js`, running entirely in the browser.

**Tokenisation** converts text to lowercase, splits on non-alphabetic characters, and filters stopwords using a Set for O(1) lookup rather than an Array's O(n) includes():

```javascript
export function tokenize(text) {
  return text.toLowerCase().split(/[^a-z]+/)
    .filter(word => word.length > 1 && !STOPWORDS.has(word));
}
```

**Term Frequency** builds a Map of normalised word frequencies. Using a Map provides O(1) insertion and lookup for building the frequency dictionary:

```javascript
export function computeTF(tokens) {
  const freqMap = new Map();
  const total = tokens.length;
  if (total === 0) return freqMap;
  for (const token of tokens) {
    freqMap.set(token, (freqMap.get(token) || 0) + 1);
  }
  for (const [word, count] of freqMap) {
    freqMap.set(word, count / total);
  }
  return freqMap;
}
```

**Inverse Document Frequency** computes IDF(t) = log(N / df(t)) for each word across all 100 missions. Common words like "support" get low IDF; rare words like "reef" get high IDF. The logarithm dampens the effect so extremely rare words do not dominate. I use a Set per document to count each word only once, preventing repeated words from inflating document frequency:

```javascript
export function computeIDF(corpus) {
  const N = corpus.length;
  const docFreq = new Map();
  for (const doc of corpus) {
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
```

**Cosine Similarity** measures the angle between two TF-IDF vectors: cosine(A, B) = (A . B) / (|A| x |B|). This produces a score between 0 and 1 regardless of document length, which is important since missions range from 8 to 30 words. I represent vectors as sparse Maps where only non-zero dimensions are stored — significantly more memory-efficient than dense arrays since most vocabulary words do not appear in any given document. Zero-magnitude vectors (from documents containing only stopwords) return 0 to prevent division by zero.

```javascript
export function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0, magnitudeA = 0, magnitudeB = 0;
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
  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
}
```

To avoid recomputing the IDF map every time the user runs a search, I precompute it once when the charity data first loads via `buildCorpusIndex()`, which runs in O(N x L) time where N is the number of charities and L is the average mission length in tokens. After this one-time computation, each subsequent query only requires computing TF for the query terms and one cosine similarity calculation per mission, making repeated searches much faster.

TF-IDF scores are blended with NLP API scores at a 70/30 ratio in `home.js`. I chose 70/30 because the NLP model is stronger at understanding semantic meaning (for example, "kids" correctly matches "children" because the sentence-transformer encodes meaning, not just words), while TF-IDF is better at catching exact keyword matches that the semantic model sometimes underweights. If the API call fails entirely, the catch block falls back to TF-IDF scores alone, which means the application always returns results regardless of whether the external service is available. This graceful degradation was an important design decision because the free-tier Render hosting frequently experiences cold starts of 30 seconds or more.

---

## 3. Levenshtein Edit Distance for Fuzzy Search

Users may want to find a specific charity without going through the full wizard. Exact string matching would be too restrictive since users frequently misspell terms ("enviroment" instead of "environment"). I implemented the Levenshtein distance algorithm using dynamic programming to enable typo-tolerant search.

The algorithm computes the minimum single-character edits (insertions, deletions, substitutions) to transform one string into another. It builds a 2D matrix of size (m+1) x (n+1). Base cases fill the first row and column with incremental values. Each cell uses the recurrence: matrix[i][j] = min(delete, insert, substitute), where cost is 0 if characters match and 1 otherwise. Time and space complexity are both O(m x n).

```javascript
export function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const matrix = [];
  for (let i = 0; i <= m; i++) matrix[i] = [i];
  for (let j = 0; j <= n; j++) matrix[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,        // deletion
        matrix[i][j - 1] + 1,        // insertion
        matrix[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  return matrix[m][n];
}
```

Raw edit distance is not directly comparable between strings of different lengths — a distance of 3 is a close match for a 20-character string but a poor match for a 4-character string. I normalise it to a 0-1 similarity scale using `1 - distance / max(a.length, b.length)`, which makes scores comparable regardless of string length. The search function then scores each charity by matching every query word against both the charity name (weighted at 60%) and mission text (weighted at 40%). Name matches are weighted higher because users searching by name expect name-relevant results first. Results below a 0.4 similarity threshold are filtered out to prevent irrelevant matches from cluttering the interface. The search input is debounced at 300ms to avoid running the algorithm on every single keystroke, which would otherwise compute Levenshtein distance against all 100 charities for each character typed.

---

## 4. Batch API Optimisation

The original implementation made 100 sequential HTTP requests to the NLP backend — one for each charity in the database. Each request involved a full network round trip plus API processing time, and on Render's free tier with cold starts this could take several minutes to complete. I identified this as a major performance bottleneck and created a `/batch-similarity` endpoint that accepts all 100 charity missions in a single request. On the frontend, the 100-iteration fetch loop was replaced with one batch call that sends all missions at once and zips the returned score array back to the corresponding charity objects. This reduces the number of network round trips from O(n) to O(1) where n is the number of charities, meaning total time is now dominated by server-side computation rather than accumulated network latency.

---

## 5. Tools and Modularity

| Tool | Justification |
|---|---|
| **HF Inference API** (`all-MiniLM-L6-v2`) | Understands semantic meaning ("kids" matches "children"), which TF-IDF cannot. Hosted API avoids needing a GPU. |
| **Flask** | Lightweight — only two endpoints needed, no ORM or templates required. |
| **Firebase Auth** | Secure email/password auth with token management, avoiding a custom auth system. |
| **Firestore** | Per-user subcollections model saved charities naturally; security rules enforce data ownership. |

The `tfidf.js` and `search.js` modules are pure functions with no DOM dependencies, keeping algorithmic logic separate from presentation. The `home.js` module imports from both and handles all UI interaction.
