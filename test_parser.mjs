import { parseQuestions } from './src/services/parserService.js';

function runTest(name, text, expected) {
  const result = parseQuestions(text);
  const pass = result.questions.length === expected;
  console.log(`${pass ? '✅' : '❌'} ${name}: ${result.questions.length}/${expected} questions`);
  result.questions.forEach((q, i) => {
    console.log(`   Q${i+1}: "${q.questionText.slice(0, 50).padEnd(50)}" | ${q.options.length} opts (${q.options.map(o=>o.label).join(',')}) | Ans: ${q.correctAnswer || '-'} | conf: ${q.confidence}(${q.confidenceScore})`);
  });
  if (result.warnings.length) console.log(`   ⚠ ${result.warnings.join('; ')}`);
  console.log('');
  return pass;
}

let passed = 0, total = 0;

// Test 1: Standard A) format
total++;
if (runTest('Standard A) format', `1. What is the capital of France?
A) London
B) Paris
C) Berlin
D) Madrid
Answer: B

2. Which planet is closest to the Sun?
A) Venus
B) Earth
C) Mercury
D) Mars
Answer: C

3. What is 2 + 2?
A) 3
B) 4
C) 5
D) 6
Answer: B`, 3)) passed++;

// Test 2: Mixed formats (5 questions)
total++;
if (runTest('Mixed formats (5 questions)', `1. What is the chemical formula of water?
A) H2O
B) CO2
C) NaCl
D) O2
Answer: A

2) The largest planet in our solar system is:
a) Mars
b) Jupiter
c) Saturn
d) Neptune
Ans: B

Q3. Who wrote the Indian National Anthem?
(A) Bankim Chandra Chatterjee
(B) Rabindranath Tagore
(C) Sarojini Naidu
(D) Mahatma Gandhi
Correct Answer: B

Que. 4 The capital of Madhya Pradesh is:
A. Indore
B. Bhopal
C. Jabalpur
D. Gwalior
Ans: B

5. What does CPU stand for?
a. Central Processing Unit
b. Central Program Unit
c. Computer Processing Unit
d. Computer Program Unit
Ans. A`, 5)) passed++;

// Test 3: Parenthesized options
total++;
if (runTest('Parenthesized (A)(B)(C)(D)', `1. The speed of light is approximately:
(A) 300,000 km/s
(B) 150,000 km/s
(C) 1,000 km/s
(D) 30,000 km/s
Answer: A

2. DNA stands for:
(A) Deoxyribonucleic Acid
(B) Dinitro Acid
(C) Deoxyribose Nucleic Acid
(D) None of the above
Answer: A`, 2)) passed++;

// Test 4: Dot-style options A. B. C. D.
total++;
if (runTest('Dot-style A. B. C. D.', `1. The Mughal Empire was founded by:
A. Akbar
B. Babur
C. Humayun
D. Shah Jahan
Answer: B

2. Which river is the longest in India?
A. Yamuna
B. Ganga
C. Godavari
D. Brahmaputra
Answer: B`, 2)) passed++;

// Test 5: No answer keys
total++;
if (runTest('No answer keys', `1. What color is the sky?
A) Blue
B) Red
C) Green
D) Yellow

2. How many days in a week?
A) 5
B) 6
C) 7
D) 8`, 2)) passed++;

// Test 6: Question/Que. numbering style
total++;
if (runTest('Question/Que. numbering', `Question 1: What is the national bird of India?
A) Eagle
B) Peacock
C) Sparrow
D) Parrot
Answer: B

Que. 2 The chemical symbol for Gold is:
A) Au
B) Ag
C) Fe
D) Cu
Answer: A`, 2)) passed++;

// Test 7: Multi-line questions
total++;
if (runTest('Multi-line questions', `1. Read the following passage and answer the question:
"The Earth revolves around the Sun in approximately 365.25 days."
What is the approximate time for Earth to revolve around the Sun?
A) 300 days
B) 365 days
C) 400 days
D) 365.25 days
Answer: D

2. Consider the following statements:
I. The President is the head of state.
II. The Prime Minister is the head of government.
Which of the above is/are correct?
A) I only
B) II only
C) Both I and II
D) Neither I nor II
Answer: C`, 2)) passed++;

// Test 8: Lowercase options a) b) c) d)
total++;
if (runTest('Lowercase a) b) c) d)', `1. What is the boiling point of water?
a) 50 degrees
b) 100 degrees
c) 150 degrees
d) 200 degrees
Ans: b

2. Which gas do plants absorb?
a) Oxygen
b) Nitrogen
c) Carbon dioxide
d) Hydrogen
Ans: c`, 2)) passed++;

// Test 9: Hindi answer format
total++;
if (runTest('Hindi answer key', `1. Bharat ki rajdhani kya hai?
A) Mumbai
B) Delhi
C) Kolkata
D) Chennai
उत्तर: B`, 1)) passed++;

// =====================================================
// NEW: Noise Tolerance Tests
// =====================================================

// Test 10: Asterisks and markdown noise
total++;
if (runTest('Asterisks/markdown noise', `**1. What is the capital of India?**
A) Mumbai
B) Delhi
C) Kolkata
D) Chennai
* Answer: B

**2. Which is the largest ocean?**
A) Atlantic
B) Pacific
C) Indian
D) Arctic
**Ans : B`, 2)) passed++;

// Test 11: Checkmarks and symbols in answers
total++;
if (runTest('Checkmarks/symbols in answers', `1. What is H2O?
A) Hydrogen
B) Water
C) Oxygen
D) Nitrogen
✓ Correct Answer : B

2. 5 + 3 = ?
A) 6
B) 7
C) 8
D) 9
✔ Answer: C`, 2)) passed++;

// Test 12: Extra blank lines and inconsistent spacing
total++;
if (runTest('Extra blank lines + spacing', `1.   What   is   the   capital   of   France?

A)   London

B)   Paris

C)   Berlin

D)   Madrid

Answer: B


2.     Which planet is red?

A)  Earth

B)  Mars

C)  Jupiter

D)  Venus

Answer: B`, 2)) passed++;

// Test 13: OCR errors in keywords
total++;
if (runTest('OCR error tolerance', `1. What is the speed of light?
A) 100 km/s
B) 300000 km/s
C) 1000 km/s
D) 50000 km/s
Ansvver: B

2. Who invented telephone?
A) Edison
B) Bell
C) Tesla
D) Newton
Answor: B`, 2)) passed++;

// Test 14: Horizontal rules and decorations
total++;
if (runTest('Horizontal rules and decorations', `---
1. What is gravity?
---
A) A force
B) A speed
C) A color
D) A sound
Answer: A
___
2. What is the Sun?
===
A) A planet
B) A star
C) A moon
D) A comet
Answer: B
---`, 2)) passed++;

// Test 15: Bullets and arrows mixed in
total++;
if (runTest('Bullets and arrows', `1. Choose the correct answer:
A) First option here
B) Second option here
C) Third option here
D) Fourth option here
Answer: A

2. Select the right one:
A) Alpha
B) Beta
C) Gamma
D) Delta
Answer: C`, 2)) passed++;

console.log(`\n${'='.repeat(50)}`);
console.log(`Results: ${passed}/${total} tests passed`);
if (passed === total) {
  console.log('🎉 ALL TESTS PASSED!');
} else {
  console.log(`⚠️  ${total - passed} test(s) FAILED`);
}
