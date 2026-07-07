/**
 * Universal MCQ Parser Service v2
 *
 * Automatically detects question boundaries, option formats, and answer keys
 * from virtually any Indian competitive exam paper format (SSC, DSSSB, UPSC,
 * Banking, Railway, State PSC, School, College, Coaching papers).
 *
 * Strategy: Detect ALL option markers first, cluster them into groups,
 * then infer question boundaries from option groups.
 */

// ============================================================
// Option marker patterns (ordered by specificity)
// ============================================================

const OPTION_REGEXES = [
  // Circled numbers: ①②③④
  { regex: /(?:^|\n)\s*([①②③④⑤])\s*/gm, type: 'circled', priority: 10 },
  // Parenthesized uppercase: (A) (B) (C) (D)
  { regex: /(?:^|\n)\s*\(([A-E])\)\s*/gm, type: 'paren_upper', priority: 9 },
  // Parenthesized lowercase: (a) (b) (c) (d)
  { regex: /(?:^|\n)\s*\(([a-e])\)\s*/gm, type: 'paren_lower', priority: 9 },
  // Uppercase dot: A. B. C. D.
  { regex: /(?:^|\n)\s*([A-E])\.\s*/gm, type: 'upper_dot', priority: 7 },
  // Uppercase paren: A) B) C) D)
  { regex: /(?:^|\n)\s*([A-E])\)\s*/gm, type: 'upper_paren', priority: 7 },
  // Lowercase dot: a. b. c. d.
  { regex: /(?:^|\n)\s*([a-e])\.\s*/gm, type: 'lower_dot', priority: 6 },
  // Lowercase paren: a) b) c) d)
  { regex: /(?:^|\n)\s*([a-e])\)\s*/gm, type: 'lower_paren', priority: 6 },
  // Uppercase colon/dash: A: A- B: B-
  { regex: /(?:^|\n)\s*([A-E])\s*[:\-—]\s*/gm, type: 'upper_colon', priority: 5 },
];

// Question numbering patterns
const QUESTION_REGEXES = [
  // "Question 1" / "Que. 1" / "Que 1"
  /(?:^|\n)\s*(?:Question|Que\.?)\s+(\d+)\s*[.):—\-]?\s*/gim,
  // "Q1." / "Q1)" / "Q1:" / "Q.1" / "Q 1"
  /(?:^|\n)\s*Q\.?\s*(\d+)\s*[.):—\-]?\s*/gim,
  // "1." / "1)" / "1:" at line start (plain numbered)
  /(?:^|\n)\s*(\d+)\s*[.):\-—]\s+/gm,
  // "1 " at line start followed by a word (no delimiter, just space — weakest)
  /(?:^|\n)\s*(\d+)\s{2,}(?=[A-Z])/gm,
];

// Answer detection patterns
const ANSWER_PATTERNS = [
  /(?:Correct\s*Answer|Answer|Ans\.?|Key)\s*[:\-—.\s]+\(?([A-Ea-e①②③④1-5])\)?/gi,
  /(?:उत्तर|उतर|उत्तर\s*कुंजी)\s*[:\-—.\s]+\(?([A-Ea-e①②③④1-5])\)?/gi,
  /(?:^|\n)\s*[✓✔★\*]\s*\(?([A-Ea-e])\)?\s*$/gm,
  /\bAns\.?\s*[:=\-—\s]+([A-Ea-e])\b/gi,
];

const CIRCLED_TO_LETTER = { '①': 'A', '②': 'B', '③': 'C', '④': 'D', '⑤': 'E' };

// ============================================================
// Main Parser
// ============================================================

export function parseQuestions(rawText) {
  if (!rawText || !rawText.trim()) {
    return { questions: [], warnings: ['No text provided'] };
  }

  const text = normalizeText(rawText);
  const warnings = [];

  // Step 1: Find ALL option markers across the entire text
  const { markers, formatType } = findAllOptionMarkers(text);

  if (markers.length < 2) {
    warnings.push('Could not detect enough option markers. Returning raw text for manual editing.');
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

  // Step 2: Cluster option markers into groups (each group = one question's options)
  const optionGroups = clusterOptionsIntoGroups(markers);

  // Step 3: For each option group, extract question text + options + answer
  const questions = [];
  for (let i = 0; i < optionGroups.length; i++) {
    const group = optionGroups[i];
    const nextGroup = optionGroups[i + 1];

    // Question text region: from end of previous group (or start of text) to first option of this group
    const qTextStart = i === 0 ? 0 : getEndOfGroup(optionGroups[i - 1], text);
    const qTextEnd = group[0].index;

    // Full chunk region: from question text start to end of this group's last option
    const chunkEnd = nextGroup ? nextGroup[0].index : text.length;
    const fullChunk = text.slice(qTextStart, chunkEnd);

    // Extract answer from the region between last option and next question
    const lastOption = group[group.length - 1];
    const lastOptionEnd = getOptionTextEnd(lastOption, group, nextGroup, text);
    const afterOptionsRegion = text.slice(lastOptionEnd, chunkEnd);

    const answer = extractAnswer(afterOptionsRegion) || extractAnswer(fullChunk);

    // Build question text
    let questionText = text.slice(qTextStart, qTextEnd).trim();
    // Strip question numbering prefix
    questionText = stripQuestionNumber(questionText);

    // Build options
    const options = [];
    for (let j = 0; j < group.length; j++) {
      const marker = group[j];
      const optTextStart = marker.index + marker.fullMatch.length;
      const optTextEnd = j + 1 < group.length
        ? group[j + 1].index
        : lastOptionEnd;
      let optText = text.slice(optTextStart, optTextEnd).trim();

      // Clean answer lines out of option text
      optText = removeAnswerLines(optText);

      options.push({
        label: normalizeLabel(marker.label),
        text: cleanText(optText),
      });
    }

    // Determine confidence
    let confidence = 'high';
    if (options.length < 2) {
      confidence = 'low';
      warnings.push(`Q${i + 1}: Only ${options.length} option(s) found`);
    } else if (!answer) {
      confidence = 'medium';
    }
    if (!questionText.trim()) {
      confidence = 'low';
      warnings.push(`Q${i + 1}: Empty question text`);
    }

    questions.push({
      id: crypto.randomUUID(),
      questionNumber: i + 1,
      questionText: cleanText(questionText),
      options,
      correctAnswer: answer,
      tags: [],
      difficulty: 'medium',
      confidence,
    });
  }

  // Summary
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
// Step 1: Find all option markers (merged from ALL patterns)
// ============================================================

function findAllOptionMarkers(text) {
  // Collect markers from ALL option patterns
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
    return { markers: [], formatType: null };
  }

  // Sort by position in text
  allMarkers.sort((a, b) => a.index - b.index);

  // Deduplicate: if multiple patterns match at the same position (within 3 chars),
  // keep the highest priority one
  const deduped = [];
  for (const marker of allMarkers) {
    const existing = deduped.find(d => Math.abs(d.index - marker.index) < 5 &&
      normalizeLabel(d.label) === normalizeLabel(marker.label));
    if (existing) {
      // Keep higher priority
      if (marker.priority > existing.priority) {
        const idx = deduped.indexOf(existing);
        deduped[idx] = marker;
      }
    } else {
      deduped.push(marker);
    }
  }

  return { markers: deduped, formatType: 'mixed' };
}

/**
 * Score how many A→B→C→D sequences exist in the markers.
 */
function scoreSequences(markers) {
  const labels = markers.map(m => normalizeLabel(m.label));
  let score = 0;

  for (let i = 0; i < labels.length - 1; i++) {
    const curr = labels[i];
    const next = labels[i + 1];
    const ci = 'ABCDE'.indexOf(curr);
    const ni = 'ABCDE'.indexOf(next);

    if (ci >= 0 && ni >= 0) {
      if (ni === ci + 1) {
        score++; // consecutive: A→B, B→C, C→D
      } else if (ni === 0 && ci >= 1) {
        score++; // reset: D→A (new question)
      }
    }
  }
  return score;
}

// ============================================================
// Step 2: Cluster option markers into groups
// ============================================================

function clusterOptionsIntoGroups(markers) {
  const groups = [];
  let currentGroup = [];

  for (let i = 0; i < markers.length; i++) {
    const label = normalizeLabel(markers[i].label);

    if (label === 'A' && currentGroup.length > 0) {
      // Start of a new group — save the previous one
      groups.push(currentGroup);
      currentGroup = [markers[i]];
    } else if (currentGroup.length === 0 && label === 'A') {
      // First option ever
      currentGroup.push(markers[i]);
    } else if (currentGroup.length === 0 && label !== 'A') {
      // Orphan option before first A — skip or start group
      currentGroup.push(markers[i]);
    } else {
      // Continue current group
      const lastLabel = normalizeLabel(currentGroup[currentGroup.length - 1].label);
      const expectedNext = String.fromCharCode(lastLabel.charCodeAt(0) + 1);

      if (label === expectedNext || label > lastLabel) {
        currentGroup.push(markers[i]);
      } else if (label === 'A') {
        // Shouldn't hit this (caught above) but safety
        groups.push(currentGroup);
        currentGroup = [markers[i]];
      } else {
        // Unexpected label order — might be a new group or OCR error
        // If it's A, definitely new group. Otherwise, just add to current.
        currentGroup.push(markers[i]);
      }
    }
  }

  // Don't forget the last group
  if (currentGroup.length > 0) {
    groups.push(currentGroup);
  }

  // Filter out groups with only 1 option (likely noise)
  return groups.filter(g => g.length >= 2);
}

// ============================================================
// Step 3: Extract answer and build question
// ============================================================

function extractAnswer(text) {
  if (!text) return null;

  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(text);
    if (match) {
      let ans = match[1].trim();
      ans = normalizeLabel(ans);
      // Also handle numeric answers
      if (/^[1-5]$/.test(ans)) {
        const map = { '1': 'A', '2': 'B', '3': 'C', '4': 'D', '5': 'E' };
        ans = map[ans] || ans;
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

function getEndOfGroup(group, text) {
  const lastMarker = group[group.length - 1];
  // Find the end of the last option's text
  // Look for the next blank line or answer pattern after the last marker
  const searchStart = lastMarker.index + lastMarker.fullMatch.length;
  const remaining = text.slice(searchStart);

  // Find the answer line if present
  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(remaining);
    if (match) {
      return searchStart + match.index + match[0].length;
    }
  }

  // Find next blank line
  const blankLine = remaining.search(/\n\s*\n/);
  if (blankLine !== -1) {
    return searchStart + blankLine;
  }

  // Find next line that looks like a question number
  for (const qRegex of QUESTION_REGEXES) {
    const re = new RegExp(qRegex.source, qRegex.flags);
    const match = re.exec(remaining);
    if (match && match.index > 5) {
      return searchStart + match.index;
    }
  }

  return text.length;
}

function getOptionTextEnd(lastMarker, group, nextGroup, text) {
  const searchStart = lastMarker.index + lastMarker.fullMatch.length;
  const remaining = text.slice(searchStart);

  // First, check for answer line
  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    const match = regex.exec(remaining);
    if (match) {
      // Return position just before the answer line
      return searchStart + match.index;
    }
  }

  // If there's a next group, return just before it
  if (nextGroup) {
    // Look backward from next group's first option to find question text start
    // The option text ends where the next question text begins
    const nextQStart = findQuestionTextStart(text, nextGroup[0].index);
    return nextQStart;
  }

  return text.length;
}

function findQuestionTextStart(text, nextOptionIndex) {
  // Look backward from the next option to find where the question starts
  // This is typically after a blank line or after an answer line

  // Search the region before the next option
  const region = text.slice(0, nextOptionIndex);

  // Try to find the last answer line before this option
  let lastAnswerEnd = -1;
  for (const pattern of ANSWER_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match;
    while ((match = regex.exec(region)) !== null) {
      const end = match.index + match[0].length;
      if (end > lastAnswerEnd) lastAnswerEnd = end;
    }
  }

  if (lastAnswerEnd > 0) {
    // Skip whitespace/newlines after the answer
    const after = region.slice(lastAnswerEnd);
    const ws = after.match(/^\s*/);
    return lastAnswerEnd + (ws ? ws[0].length : 0);
  }

  // Try blank line
  const lastBlank = region.lastIndexOf('\n\n');
  if (lastBlank > 0) {
    return lastBlank + 2;
  }

  // Try last newline
  const lastNL = region.lastIndexOf('\n');
  if (lastNL > 0) {
    return lastNL + 1;
  }

  return 0;
}

function stripQuestionNumber(text) {
  // Remove leading question number patterns
  return text
    .replace(/^\s*(?:Question|Que\.?|Q\.?)\s*\d+\s*[.):—\-]?\s*/i, '')
    .replace(/^\s*\d+\s*[.):\-—]\s*/, '')
    .replace(/^\s*\d+\s{2,}/, '')
    .trim();
}

// ============================================================
// Utilities
// ============================================================

function normalizeText(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\t/g, '  ')
    .replace(/\|/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\n{4,}/g, '\n\n\n')
    .replace(/[ ]{4,}/g, '  ')
    .trim();
}

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
    .replace(/\|/g, '')
    .trim();
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

export function buildCustomPattern() {
  return null;
}

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
