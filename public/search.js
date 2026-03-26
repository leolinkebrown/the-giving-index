// Charity search module with Levenshtein distance for fuzzy matching
// Allows users to find charities by name or mission even with typos

// ── Levenshtein Edit Distance (Dynamic Programming) ──

export function levenshteinDistance(a, b) {
  // Build a 2D matrix where matrix[i][j] represents the minimum edits
  // needed to transform the first i characters of a into the first j of b
  const m = a.length;
  const n = b.length;

  // Create (m+1) x (n+1) matrix initialized with base cases
  const matrix = [];
  for (let i = 0; i <= m; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= n; j++) {
    matrix[0][j] = j;
  }

  // Fill the matrix using the recurrence relation:
  // matrix[i][j] = min(delete, insert, substitute)
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[m][n];
}

// ── Normalized Similarity (0 to 1) ──

export function normalizedSimilarity(a, b) {
  if (a.length === 0 && b.length === 0) return 1;
  const distance = levenshteinDistance(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

// ── Word-Level Fuzzy Match ──

function bestWordMatch(queryWord, text) {
  // Find the best matching word in the text for a given query word
  const words = text.toLowerCase().split(/[^a-z]+/).filter(w => w.length > 1);
  let best = 0;

  for (const word of words) {
    // Exact substring match scores highest
    if (word.includes(queryWord) || queryWord.includes(word)) {
      best = Math.max(best, 0.9);
    }
    // Levenshtein similarity for fuzzy matching
    const sim = normalizedSimilarity(queryWord, word);
    best = Math.max(best, sim);
  }

  return best;
}

// ── Search Charities ──

export function searchCharities(query, charities) {
  // Score each charity by how well it matches the search query
  // Combines name matching (weighted higher) and mission matching
  const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 0);

  if (queryWords.length === 0) return [];

  const scored = charities.map(charity => {
    let totalScore = 0;

    for (const qWord of queryWords) {
      // Name match weighted at 60%, mission match at 40%
      const nameScore = bestWordMatch(qWord, charity.name);
      const missionScore = bestWordMatch(qWord, charity.mission);
      totalScore += 0.6 * nameScore + 0.4 * missionScore;
    }

    // Average across query words
    const avgScore = totalScore / queryWords.length;

    return { ...charity, searchScore: avgScore };
  });

  // Filter out very low matches and sort by score descending
  return scored
    .filter(c => c.searchScore > 0.4)
    .sort((a, b) => b.searchScore - a.searchScore);
}
