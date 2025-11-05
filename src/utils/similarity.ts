/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  // Initialize first column
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  // Initialize first row
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  // Calculate distances
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity ratio between two strings (0-1)
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);

  if (maxLength === 0) {
    return 1; // Both strings are empty
  }

  return 1 - distance / maxLength;
}

/**
 * Check if user's answer is correct
 * Returns quality rating: 1 (wrong), 2 (close), 3 (correct)
 */
export function checkSpelling(userAnswer: string, correctAnswer: string): {
  quality: number;
  feedback: 'correct' | 'close' | 'wrong';
  similarity: number;
} {
  // Normalize answers
  const userNormalized = userAnswer.trim().toLowerCase();
  const correctNormalized = correctAnswer.trim().toLowerCase();

  // Exact match
  if (userNormalized === correctNormalized) {
    return {
      quality: 3,
      feedback: 'correct',
      similarity: 1.0
    };
  }

  // Calculate similarity
  const similarity = calculateSimilarity(userNormalized, correctNormalized);

  // Close match (>80% similar)
  if (similarity > 0.8) {
    return {
      quality: 2,
      feedback: 'close',
      similarity
    };
  }

  // Wrong
  return {
    quality: 1,
    feedback: 'wrong',
    similarity
  };
}
