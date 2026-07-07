/**
 * Question Parser Service
 *
 * Parses raw OCR/pasted text into structured MCQ questions.
 * Supports multiple preset patterns and custom user-defined patterns.
 */

// ============================================================
// Preset Pattern Templates
// ============================================================

export const PARSER_PRESETS = {
  standard: {
    id: 'standard',
    name: 'Standard Numbered (Q1. / 1. / 1))',
    description: 'Matches Q1., 1., 1), Question 1:, etc.',
    questionPattern: /(?:^|\n)\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[.):\-]\s*/gi,
    optionPattern: /(?:^|\n)\s*([A-Da-d])\s*[.):\-]\s*/g,
    answerPattern: /(?:Ans(?:wer)?|Correct\s*Answer)\s*[:\-\s]*([A-Da-d])/gi,
  },
  parenthesized: {
    id: 'parenthesized',
    name: 'Parenthesized Options ((a), (b), (c), (d))',
    description: 'Question: 1. / 1)  Options: (a), (b), (c), (d)',
    questionPattern: /(?:^|\n)\s*(\d+)\s*[.)]\s*/g,
    optionPattern: /(?:^|\n)\s*\(([A-Da-d])\)\s*/g,
    answerPattern: /(?:Ans(?:wer)?|Correct\s*Answer)\s*[:\-\s]*\(?([A-Da-d])\)?/gi,
  },
  lettered: {
    id: 'lettered',
    name: 'Lettered Options (A., B., C., D.)',
    description: 'Question: numbered, Options: A. B. C. D.',
    questionPattern: /(?:^|\n)\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d+)\s*[.):\-]\s*/gi,
    optionPattern: /(?:^|\n)\s*([A-D])\s*[.)]\s*/g,
    answerPattern: /(?:Ans(?:wer)?|Correct\s*Answer|Key)\s*[:\-\s]*([A-Da-d])/gi,
  },
};

// ============================================================
// Core Parser
// ============================================================

/**
 * Parse raw text into structured questions.
 *
 * @param {string} rawText - The raw text from OCR or paste
 * @param {string|object} preset - Preset ID or custom pattern object
 * @returns {{ questions: ParsedQuestion[], warnings: string[] }}
 */
export function parseQuestions(rawText, preset = 'standard') {
  if (!rawText || !rawText.trim()) {
    return { questions: [], warnings: ['No text provided'] };
  }

  const patterns = typeof preset === 'string' ? PARSER_PRESETS[preset] : preset;
  if (!patterns) {
    return { questions: [], warnings: ['Invalid parser preset'] };
  }

  const warnings = [];
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Step 1: Split into question chunks by finding question number boundaries
  const questionChunks = splitByQuestions(text, patterns.questionPattern);

  if (questionChunks.length === 0) {
    warnings.push('No questions detected. Try a different parser pattern or edit manually.');
    // Return the whole text as a single question for manual editing
    return {
      questions: [{
        id: crypto.randomUUID(),
        questionNumber: 1,
        questionText: text.trim(),
        options: [],
        correctAnswer: null,
        tags: [],
        difficulty: 'medium',
        confidence: 'low',
      }],
      warnings,
    };
  }

  // Step 2: Parse each chunk into question + options + answer
  const questions = [];

  for (let i = 0; i < questionChunks.length; i++) {
    const chunk = questionChunks[i];
    const parsed = parseQuestionChunk(chunk.text, chunk.number, patterns);

    if (parsed.options.length < 2) {
      parsed.confidence = 'low';
      if (parsed.options.length === 0) {
        warnings.push(`Question ${chunk.number}: No options detected`);
      }
    } else if (parsed.options.length >= 2 && parsed.options.length <= 6) {
      parsed.confidence = parsed.correctAnswer ? 'high' : 'medium';
    }

    questions.push({
      id: crypto.randomUUID(),
      questionNumber: i + 1,
      ...parsed,
      tags: [],
      difficulty: 'medium',
    });
  }

  if (questions.length > 0) {
    const lowConfidence = questions.filter(q => q.confidence === 'low').length;
    if (lowConfidence > 0) {
      warnings.push(`${lowConfidence} question(s) may need manual review (low confidence)`);
    }
  }

  return { questions, warnings };
}

/**
 * Split text into question chunks based on question numbering pattern.
 */
function splitByQuestions(text, questionPattern) {
  const chunks = [];
  const regex = new RegExp(questionPattern.source, questionPattern.flags);
  const matches = [...text.matchAll(regex)];

  if (matches.length === 0) return [];

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const startIndex = match.index + match[0].length;
    const endIndex = i + 1 < matches.length ? matches[i + 1].index : text.length;
    const chunkText = text.slice(startIndex, endIndex).trim();

    chunks.push({
      number: parseInt(match[1], 10) || (i + 1),
      text: chunkText,
    });
  }

  return chunks;
}

/**
 * Parse a single question chunk into structured data.
 */
function parseQuestionChunk(chunkText, questionNumber, patterns) {
  // Try to find answer first (it might be at the end)
  let correctAnswer = null;
  let textWithoutAnswer = chunkText;

  const answerRegex = new RegExp(patterns.answerPattern.source, patterns.answerPattern.flags);
  const answerMatch = answerRegex.exec(chunkText);
  if (answerMatch) {
    correctAnswer = answerMatch[1].toUpperCase();
    // Remove the answer line from the chunk
    textWithoutAnswer = chunkText.replace(answerMatch[0], '').trim();
  }

  // Split into question text and options
  const optionRegex = new RegExp(patterns.optionPattern.source, patterns.optionPattern.flags);
  const optionMatches = [...textWithoutAnswer.matchAll(optionRegex)];

  let questionText = '';
  const options = [];

  if (optionMatches.length > 0) {
    // Question text is everything before the first option
    questionText = textWithoutAnswer.slice(0, optionMatches[0].index).trim();

    // Extract each option
    for (let i = 0; i < optionMatches.length; i++) {
      const optMatch = optionMatches[i];
      const optStart = optMatch.index + optMatch[0].length;
      const optEnd = i + 1 < optionMatches.length ? optionMatches[i + 1].index : textWithoutAnswer.length;
      const optText = textWithoutAnswer.slice(optStart, optEnd).trim();

      options.push({
        label: optMatch[1].toUpperCase(),
        text: optText,
      });
    }
  } else {
    // No options found — the whole chunk is the question text
    questionText = textWithoutAnswer;
  }

  return {
    questionText: cleanText(questionText),
    options: options.map(o => ({ ...o, text: cleanText(o.text) })),
    correctAnswer,
  };
}

/**
 * Clean up OCR artifacts from text.
 */
function cleanText(text) {
  return text
    .replace(/\s+/g, ' ')       // collapse whitespace
    .replace(/^\s+|\s+$/g, '')  // trim
    .replace(/\|/g, '')         // remove stray pipes from OCR
    .replace(/\s*\n\s*/g, ' ')  // flatten newlines into spaces
    .trim();
}

// ============================================================
// Custom Pattern Builder
// ============================================================

/**
 * Create a custom pattern object from user-provided regex strings.
 *
 * @param {string} questionRegex - Regex string for question splitting
 * @param {string} optionRegex - Regex string for option detection
 * @param {string} answerRegex - Regex string for answer detection
 * @returns {object} Pattern object compatible with parseQuestions
 */
export function buildCustomPattern(questionRegex, optionRegex, answerRegex) {
  try {
    return {
      id: 'custom',
      name: 'Custom Pattern',
      questionPattern: new RegExp(questionRegex, 'gi'),
      optionPattern: new RegExp(optionRegex, 'g'),
      answerPattern: new RegExp(answerRegex, 'gi'),
    };
  } catch (err) {
    throw new Error(`Invalid regex pattern: ${err.message}`);
  }
}

/**
 * Test a pattern against sample text (for preview).
 *
 * @param {string} sampleText
 * @param {object} patterns
 * @returns {{ matchCount: number, preview: string }}
 */
export function testPattern(sampleText, patterns) {
  try {
    const regex = new RegExp(patterns.questionPattern.source, patterns.questionPattern.flags);
    const matches = [...sampleText.matchAll(regex)];
    return {
      matchCount: matches.length,
      preview: matches.length > 0
        ? `Found ${matches.length} question(s). First match: "${matches[0][0].trim()}"`
        : 'No matches found.',
    };
  } catch (err) {
    return { matchCount: 0, preview: `Error: ${err.message}` };
  }
}
