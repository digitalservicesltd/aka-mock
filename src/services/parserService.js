/**
 * Universal MCQ Parser Service v3
 *
 * Pipeline architecture:
 * 1. Sanitize text (strip noise, normalize symbols)
 * 2. OCR error correction (fuzzy keyword matching)
 * 3. Detect ALL option markers (merged from all format patterns)
 * 4. Cluster option markers into A-B-C-D groups
 * 5. Extract question text + options + answer for each group
 * 6. Validate & score confidence (0-100)
 * 7. Output structured JSON
 *
 * Handles: SSC, DSSSB, UPSC, Banking, Railway, State PSC, CBSE, coaching papers.
 * Never rejects an entire paper — always returns best-effort results.
 */

// ============================================================
// Option marker patterns (ordered by specificity)
// ============================================================

const OPTION_REGEXES = [
  { regex: /(?:^|\n)\s*([①②③④⑤])\s*/gm, type: 'circled', priority: 10 },
  { regex: /(?:^|\n)\s*\(([A-E])\)\s*/gm, type: 'paren_upper', priority: 9 },
  { regex: /(?:^|\n)\s*\(([a-e])\)\s*/gm, type: 'paren_lower', priority: 9 },
  { regex: /(?:^|\n)\s*([A-E])\.\s+/gm, type: 'upper_dot', priority: 7 },
  { regex: /(?:^|\n)\s*([A-E])\)\s*/gm, type: 'upper_paren', priority: 7 },
  { regex: /(?:^|\n)\s*([a-e])\.\s+/gm, type: 'lower_dot', priority: 6 },
  { regex: /(?:^|\n)\s*([a-e])\)\s*/gm, type: 'lower_paren', priority: 6 },
  { regex: /(?:^|\n)\s*([A-E])\s*[:\-—]\s+/gm, type: 'upper_colon', priority: 5 },
];

// Question numbering patterns
const QUESTION_REGEXES = [
  /(?:^|\n)\s*(?:Question|Que\.?)\s+(\d+)\s*[.):—\-]?\s*/gim,
  /(?:^|\n)\s*Q\.?\s*(\d+)\s*[.):—\-]?\s*/gim,
  /(?:^|\n)\s*(\d+)\s*[.):\-—]\s+/gm,
];

// Answer detection patterns — very broad to handle noise
const ANSWER_PATTERNS = [
  // Standard: Answer: B, Ans: B, Ans. B, Correct Answer: B, Key: B
  /(?:Correct\s*Answer|Answer|Ans\.?|Key)\s*[:\-—.\s=]+\(?([A-Ea-e①②③④1-5])\)?/gi,
  // Hindi: उत्तर: B, उतर: B
  /(?:उत्तर|उतर|उत्तर\s*कुंजी)\s*[:\-—.\s=]+\(?([A-Ea-e①②③④1-5])\)?/gi,
  // Checkmark at line start: ✓ B, ✔ B, ★ B
  /(?:^|\n)\s*[✓✔]\s*\(?([A-Ea-e])\)?\s*$/gm,
  // Standalone "Ans" with various separators
  /\bAns\.?\s*[:=\-—.\s]+([A-Ea-e])\b/gi,
];

const CIRCLED_TO_LETTER = { '①': 'A', '②': 'B', '③': 'C', '④': 'D', '⑤': 'E' };

// ============================================================
// Stage 1: Text Sanitization
// ============================================================

function sanitizeText(raw) {
  let text = raw;

  // Normalize line endings
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Remove zero-width and invisible characters
  text = text.replace(/[\u200B-\u200D\uFEFF\u00AD]/g, '');

  // Normalize non-breaking spaces
  text = text.replace(/\u00A0/g, ' ');

  // Normalize curly quotes to straight quotes
  text = text.replace(/[\u2018\u2019\u201A]/g, "'");
  text = text.replace(/[\u201C\u201D\u201E]/g, '"');

  // Normalize dashes/hyphens
  text = text.replace(/[\u2013\u2014\u2015]/g, '-');

  // Remove horizontal rules (---, ___, ===, ***)
  text = text.replace(/^[\s]*[-_=*]{3,}[\s]*$/gm, '');

  // Remove markdown bold/italic markers but keep content
  // **text** → text,  *text* → text,  __text__ → text
  text = text.replace(/\*{2,}([^*]+)\*{2,}/g, '$1');
  text = text.replace(/(?<![A-Za-z])\*([^*\n]+)\*(?![A-Za-z])/g, '$1');
  text = text.replace(/_{2,}([^_]+)_{2,}/g, '$1');

  // Remove stray asterisks at line start (bullet-like)
  text = text.replace(/^[\s]*\*[\s]+/gm, '');

  // Remove decorative bullets and arrows (but not option markers)
  text = text.replace(/[►▸▹▻▷◆◇◈◉○●■□▪▫•→←↑↓⇒⇐⇑⇓✦✧★☆✶✸✹✺✻✼✽✾✿❀❁❂❃❄❅❆❇❈❉❊❋]/g, '');

  // Remove OCR pipe artifacts
  text = text.replace(/\|/g, '');

  // Normalize tabs to spaces
  text = text.replace(/\t/g, '  ');

  // Collapse excessive spaces (4+ → 2)
  text = text.replace(/[ ]{4,}/g, '  ');

  // Collapse excessive blank lines (4+ → 2)
  text = text.replace(/\n{4,}/g, '\n\n\n');

  // Remove image placeholders
  text = text.replace(/\[(?:image|img|figure|diagram|chart).*?\]/gi, '');

  return text.trim();
}

// ============================================================
// Stage 2: OCR Error Correction
// ============================================================

/**
 * Fix common OCR mistakes in keywords.
 * Uses targeted replacements (not full fuzzy — that's too slow for large texts).
 */
function fixOCRErrors(text) {
  // Common OCR substitutions for key terms
  const corrections = [
    // "Question" variants
    [/\bQuest[il1]on\b/gi, 'Question'],
    [/\bQu[eo]st[il1]on\b/gi, 'Question'],
    [/\bQuestiou\b/gi, 'Question'],
    // "Option" variants
    [/\b[O0]pt[il1]on\b/gi, 'Option'],
    [/\b[O0]ption\b/gi, 'Option'],
    // "Answer" variants
    [/\bAnsvver\b/gi, 'Answer'],
    [/\bAnsw[ce]r\b/gi, 'Answer'],
    [/\bAnsw[eo]r\b/gi, 'Answer'],
    [/\bAnsvv[eo]r\b/gi, 'Answer'],
    [/\bAns vver\b/gi, 'Answer'],
    // "Correct" variants
    [/\bC[o0]rrect\b/gi, 'Correct'],
    [/\bCorr[eo]ct\b/gi, 'Correct'],
    // Common number/letter swaps
    [/\bQue\s*\.\s*(\d)/gi, 'Que. $1'],
  ];

  let fixed = text;
  for (const [pattern, replacement] of corrections) {
    fixed = fixed.replace(pattern, replacement);
  }
  return fixed;
}

// ============================================================
// Stage 3: Find all option markers (merged from ALL patterns)
// ============================================================

function findAllOptionMarkers(text) {
  const allMarkers = [];

  for (const pattern of OPTION_REGEXES) {
    const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
    const matches = [...text.matchAll(regex)];
    if (matches.length < 2) continue;

    for (const m of matches) {
      allMarkers.push({
        index: m.index,
        label: m[1],
        fullMatch: m[0],
        type: pattern.type,
        priority: pattern.priority,
      });
    }
  }

  if (allMarkers.length < 2) {
    return [];
  }

  // Sort by position
  allMarkers.sort((a, b) => a.index - b.index);

  // Deduplicate: same position + same normalized label → keep highest priority
  const deduped = [];
  for (const marker of allMarkers) {
    const normLabel = normalizeLabel(marker.label);
    const existing = deduped.find(d =>
      Math.abs(d.index - marker.index) < 5 &&
      normalizeLabel(d.label) === normLabel
    );
    if (existing) {
      if (marker.priority > existing.priority) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = marker;
      }
    } else {
      deduped.push(marker);
    }
  }

  return deduped;
}

// ============================================================
// Stage 4: Cluster option markers into groups
// ============================================================

function clusterOptionsIntoGroups(markers) {
  const groups = [];
  let currentGroup = [];

  for (let i = 0; i < markers.length; i++) {
    const label = normalizeLabel(markers[i].label);

    if (label === 'A' && currentGroup.length > 0) {
      groups.push(currentGroup);
      currentGroup = [markers[i]];
    } else if (currentGroup.length === 0) {
      currentGroup.push(markers[i]);
    } else {
      const lastLabel = normalizeLabel(currentGroup[currentGroup.length - 1].label);
      const expectedNext = String.fromCharCode(lastLabel.charCodeAt(0) + 1);

      if (label === expectedNext || label > lastLabel) {
        currentGroup.push(markers[i]);
      } else if (label === 'A') {
        groups.push(currentGroup);
        currentGroup = [markers[i]];
      } else {
        // Unexpected order — still add (could be OCR error)
        currentGroup.push(markers[i]);
      }
    }
  }

  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Keep groups with at least 2 options
  return groups.filter(g => g.length >= 2);
}

// ============================================================
// Stage 5: Extract question + options + answer
// ============================================================

function extractQuestionsFromGroups(text, optionGroups) {
  const questions = [];

  for (let i = 0; i < optionGroups.length; i++) {
    const group = optionGroups[i];
    const nextGroup = optionGroups[i + 1];

    // Question text: from end of previous group to first option of this group
    const qTextStart = i === 0 ? 0 : getEndOfGroup(optionGroups[i - 1], text);
    const qTextEnd = group[0].index;

    // End of this group's region
    const regionEnd = nextGroup
      ? findQuestionTextStart(text, nextGroup[0].index)
      : text.length;

    // Extract question text
    let questionText = text.slice(qTextStart, qTextEnd).trim();
    questionText = stripQuestionNumber(questionText);

    // Extract options
    const options = [];
    for (let j = 0; j < group.length; j++) {
      const marker = group[j];
      const optStart = marker.index + marker.fullMatch.length;
      const optEnd = j + 1 < group.length ? group[j + 1].index : null;

      // If last option, find where option text ends (before answer or next question)
      const lastOptEnd = optEnd || findOptionEnd(text, optStart, regionEnd);

      let optText = text.slice(optStart, lastOptEnd).trim();
      optText = removeAnswerLines(optText);

      options.push({
        label: normalizeLabel(marker.label),
        text: cleanText(optText),
      });
    }

    // Extract answer from region after options
    const lastMarker = group[group.length - 1];
    const afterOptionsStart = lastMarker.index + lastMarker.fullMatch.length;
    const afterRegion = text.slice(afterOptionsStart, regionEnd);
    const answer = extractAnswer(afterRegion) ||
                   extractAnswer(text.slice(qTextStart, regionEnd));

    questions.push({
      questionText: cleanText(questionText),
      options,
      correctAnswer: answer,
    });
  }

  return questions;
}

function getEndOfGroup(group, text) {
  const lastMarker = group[group.length - 1];
  const searchStart = lastMarker.index + lastMarker.fullMatch.length;
  const remaining = text.slice(searchStart);

  // Check for answer line
  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(remaining);
    if (match) {
      const lineEnd = remaining.indexOf('\n', match.index + match[0].length);
      return searchStart + (lineEnd !== -1 ? lineEnd + 1 : match.index + match[0].length);
    }
  }

  // Find next blank line
  const blankLine = remaining.search(/\n\s*\n/);
  if (blankLine !== -1) return searchStart + blankLine + 1;

  // Find next question number
  for (const qRegex of QUESTION_REGEXES) {
    const re = new RegExp(qRegex.source, qRegex.flags);
    const match = re.exec(remaining);
    if (match && match.index > 5) return searchStart + match.index;
  }

  return text.length;
}

function findOptionEnd(text, optStart, regionEnd) {
  // Find the end of the last option text
  const region = text.slice(optStart, regionEnd);

  // Look for answer line
  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(region);
    if (match) return optStart + match.index;
  }

  // Look for blank line followed by content (next question)
  const blankThenContent = region.search(/\n\s*\n/);
  if (blankThenContent !== -1) return optStart + blankThenContent;

  return regionEnd;
}

function findQuestionTextStart(text, nextOptionIndex) {
  const region = text.slice(0, nextOptionIndex);

  // Find last answer line before this option
  let lastAnswerEnd = -1;
  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(region)) !== null) {
      const lineEnd = region.indexOf('\n', match.index + match[0].length);
      const end = lineEnd !== -1 ? lineEnd + 1 : match.index + match[0].length;
      if (end > lastAnswerEnd) lastAnswerEnd = end;
    }
  }

  if (lastAnswerEnd > 0) return lastAnswerEnd;

  // Find last double blank line
  const lastBlank = region.lastIndexOf('\n\n');
  if (lastBlank > 0) return lastBlank + 2;

  // Find last single newline
  const lastNL = region.lastIndexOf('\n');
  if (lastNL > 0) return lastNL + 1;

  return 0;
}

function extractAnswer(text) {
  if (!text) return null;

  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match) {
      let ans = match[1].trim();
      ans = normalizeLabel(ans);
      if (/^[1-5]$/.test(ans)) {
        ans = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' }[ans] || ans;
      }
      return ans;
    }
  }
  return null;
}

function removeAnswerLines(text) {
  let result = text;
  for (const pattern of ANSWER_PATTERNS) {
    result = result.replace(new RegExp(pattern.source, pattern.flags), '');
  }
  return result.trim();
}

function stripQuestionNumber(text) {
  return text
    .replace(/^\s*(?:Question|Que\.?|Q\.?)\s*\d+\s*[.):—\-]?\s*/i, '')
    .replace(/^\s*\d+\s*[.):\-—]\s*/, '')
    .replace(/^\s*\d+\s{2,}/, '')
    .trim();
}

// ============================================================
// Stage 6 & 7: Validate & Score Confidence
// ============================================================

function scoreConfidence(question) {
  let score = 0;

  // +30 for having meaningful question text
  if (question.questionText && question.questionText.length > 10) {
    score += 30;
  } else if (question.questionText && question.questionText.length > 3) {
    score += 15;
  }

  // +30 for having 2-5 options
  if (question.options.length >= 4) {
    score += 30;
  } else if (question.options.length >= 2) {
    score += 20;
  } else if (question.options.length === 1) {
    score += 5;
  }

  // +20 for having answer key
  if (question.correctAnswer) {
    score += 20;
  }

  // +10 for options having meaningful text
  const optionsWithText = question.options.filter(o => o.text && o.text.length > 2);
  if (optionsWithText.length === question.options.length && question.options.length > 0) {
    score += 10;
  }

  // +10 for sequential labels (A,B,C,D)
  const labels = question.options.map(o => o.label);
  const expectedSeq = 'ABCDE'.slice(0, labels.length).split('');
  if (labels.length >= 2 && labels.every((l, i) => l === expectedSeq[i])) {
    score += 10;
  }

  return score;
}

function confidenceLevel(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'medium';
  return 'low';
}

// ============================================================
// Utilities
// ============================================================

function normalizeLabel(label) {
  if (CIRCLED_TO_LETTER[label]) return CIRCLED_TO_LETTER[label];
  if (/^[1-5]$/.test(label)) {
    return { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' }[label] || label;
  }
  return label.toUpperCase();
}

function cleanText(text) {
  return text
    .replace(/\s*\n\s*/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ============================================================
// Main Parser (Pipeline)
// ============================================================

export function parseQuestions(rawText) {
  if (!rawText || !rawText.trim()) {
    return { questions: [], warnings: ['No text provided'] };
  }

  const warnings = [];

  // Stage 1: Sanitize
  const sanitized = sanitizeText(rawText);

  // Stage 2: OCR correction
  const corrected = fixOCRErrors(sanitized);

  // Stage 3: Find all option markers
  const markers = findAllOptionMarkers(corrected);

  if (markers.length < 2) {
    warnings.push('Could not detect option markers. Returning raw text for manual editing.');
    return {
      questions: [{
        id: crypto.randomUUID(),
        questionNumber: 1,
        questionText: corrected.trim(),
        options: [],
        correctAnswer: null,
        tags: [],
        difficulty: 'medium',
        confidence: 'low',
        confidenceScore: 0,
      }],
      warnings,
    };
  }

  // Stage 4: Cluster into groups
  const optionGroups = clusterOptionsIntoGroups(markers);

  if (optionGroups.length === 0) {
    warnings.push('Found option markers but could not form complete option groups.');
    return {
      questions: [{
        id: crypto.randomUUID(),
        questionNumber: 1,
        questionText: corrected.trim(),
        options: [],
        correctAnswer: null,
        tags: [],
        difficulty: 'medium',
        confidence: 'low',
        confidenceScore: 0,
      }],
      warnings,
    };
  }

  // Stage 5: Extract questions
  const rawQuestions = extractQuestionsFromGroups(corrected, optionGroups);

  // Stage 6 & 7: Validate, score, build output
  const questions = rawQuestions.map((q, i) => {
    const confScore = scoreConfidence(q);
    const conf = confidenceLevel(confScore);

    if (conf === 'low') {
      if (q.options.length < 2) {
        warnings.push(`Q${i + 1}: Only ${q.options.length} option(s) found`);
      }
      if (!q.questionText || q.questionText.length <= 3) {
        warnings.push(`Q${i + 1}: Empty or very short question text`);
      }
    }

    return {
      id: crypto.randomUUID(),
      questionNumber: i + 1,
      questionText: q.questionText,
      options: q.options,
      correctAnswer: q.correctAnswer,
      tags: [],
      difficulty: 'medium',
      confidence: conf,
      confidenceScore: confScore,
    };
  });

  // Summary warnings
  const lowCount = questions.filter(q => q.confidence === 'low').length;
  const medCount = questions.filter(q => q.confidence === 'medium').length;
  if (lowCount > 0) {
    warnings.push(`${lowCount} question(s) flagged for manual review (low confidence)`);
  }
  if (medCount > 0 && lowCount === 0) {
    warnings.push(`${medCount} question(s) missing answer keys`);
  }

  return { questions, warnings };
}

// ============================================================
// Backward-compatible exports
// ============================================================

export const PARSER_PRESETS = {
  auto: {
    id: 'auto',
    name: 'Auto-Detect (Universal)',
    description: 'Automatically detects question numbering, option format, and answers.',
  },
};

export function buildCustomPattern() { return null; }

export function testPattern(sampleText) {
  const result = parseQuestions(sampleText);
  return {
    matchCount: result.questions.length,
    preview: result.questions.length > 0
      ? `Detected ${result.questions.length} question(s). ` +
        `Options: ${result.questions.filter(q => q.options.length >= 2).length} with 2+ options. ` +
        `Answers: ${result.questions.filter(q => q.correctAnswer).length} with answer keys.`
      : 'No questions detected.',
  };
}
