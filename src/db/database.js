import { openDB } from 'idb';

const DB_NAME = 'MockTestDB';
const DB_VERSION = 1;

const STORES = {
  QUESTION_BANKS: 'questionBanks',
  TEST_TEMPLATES: 'testTemplates',
  TEST_ATTEMPTS: 'testAttempts',
  TEST_PROGRESS: 'testProgress',
};

let dbPromise = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Question Banks store
        if (!db.objectStoreNames.contains(STORES.QUESTION_BANKS)) {
          const bankStore = db.createObjectStore(STORES.QUESTION_BANKS, { keyPath: 'id' });
          bankStore.createIndex('name', 'name');
          bankStore.createIndex('createdAt', 'createdAt');
        }

        // Test Templates store
        if (!db.objectStoreNames.contains(STORES.TEST_TEMPLATES)) {
          const templateStore = db.createObjectStore(STORES.TEST_TEMPLATES, { keyPath: 'id' });
          templateStore.createIndex('name', 'name');
          templateStore.createIndex('createdAt', 'createdAt');
        }

        // Test Attempts store
        if (!db.objectStoreNames.contains(STORES.TEST_ATTEMPTS)) {
          const attemptStore = db.createObjectStore(STORES.TEST_ATTEMPTS, { keyPath: 'id' });
          attemptStore.createIndex('templateId', 'templateId');
          attemptStore.createIndex('completedAt', 'completedAt');
        }

        // Test Progress store (auto-save)
        if (!db.objectStoreNames.contains(STORES.TEST_PROGRESS)) {
          db.createObjectStore(STORES.TEST_PROGRESS, { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
}

// ============================================================
// Question Banks CRUD
// ============================================================

export async function addQuestionBank(bank) {
  const db = await getDB();
  const record = {
    id: crypto.randomUUID(),
    name: bank.name || 'Untitled Bank',
    description: bank.description || '',
    tags: bank.tags || [],
    questions: bank.questions || [],
    questionCount: (bank.questions || []).length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORES.QUESTION_BANKS, record);
  return record;
}

export async function getAllQuestionBanks() {
  const db = await getDB();
  return db.getAll(STORES.QUESTION_BANKS);
}

export async function getQuestionBank(id) {
  const db = await getDB();
  return db.get(STORES.QUESTION_BANKS, id);
}

export async function updateQuestionBank(id, data) {
  const db = await getDB();
  const existing = await db.get(STORES.QUESTION_BANKS, id);
  if (!existing) throw new Error(`Question bank ${id} not found`);
  const updated = {
    ...existing,
    ...data,
    id, // ensure id doesn't change
    questionCount: (data.questions || existing.questions || []).length,
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORES.QUESTION_BANKS, updated);
  return updated;
}

export async function deleteQuestionBank(id) {
  const db = await getDB();
  await db.delete(STORES.QUESTION_BANKS, id);
}

// ============================================================
// Test Templates CRUD
// ============================================================

export async function addTestTemplate(template) {
  const db = await getDB();
  const record = {
    id: crypto.randomUUID(),
    name: template.name || 'Untitled Template',
    bankIds: template.bankIds || [],
    questionCount: template.questionCount || 10,
    timeLimitMinutes: template.timeLimitMinutes || 30,
    timeLimitPerQuestion: template.timeLimitPerQuestion || false,
    shuffleQuestions: template.shuffleQuestions ?? true,
    shuffleOptions: template.shuffleOptions ?? false,
    negativeMarking: template.negativeMarking ?? false,
    negativeMarkValue: template.negativeMarkValue || 0.25,
    marksPerQuestion: template.marksPerQuestion || 1,
    sections: template.sections || [],
    tagFilter: template.tagFilter || [],
    difficultyFilter: template.difficultyFilter || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await db.put(STORES.TEST_TEMPLATES, record);
  return record;
}

export async function getAllTestTemplates() {
  const db = await getDB();
  return db.getAll(STORES.TEST_TEMPLATES);
}

export async function getTestTemplate(id) {
  const db = await getDB();
  return db.get(STORES.TEST_TEMPLATES, id);
}

export async function updateTestTemplate(id, data) {
  const db = await getDB();
  const existing = await db.get(STORES.TEST_TEMPLATES, id);
  if (!existing) throw new Error(`Template ${id} not found`);
  const updated = { ...existing, ...data, id, updatedAt: new Date().toISOString() };
  await db.put(STORES.TEST_TEMPLATES, updated);
  return updated;
}

export async function deleteTestTemplate(id) {
  const db = await getDB();
  await db.delete(STORES.TEST_TEMPLATES, id);
}

// ============================================================
// Test Attempts CRUD
// ============================================================

export async function addTestAttempt(attempt) {
  const db = await getDB();
  const record = {
    id: crypto.randomUUID(),
    templateId: attempt.templateId || null,
    templateName: attempt.templateName || 'Custom Test',
    questions: attempt.questions || [],
    answers: attempt.answers || {},
    markedForReview: attempt.markedForReview || [],
    score: attempt.score || 0,
    maxScore: attempt.maxScore || 0,
    totalQuestions: attempt.totalQuestions || 0,
    correctCount: attempt.correctCount || 0,
    incorrectCount: attempt.incorrectCount || 0,
    unansweredCount: attempt.unansweredCount || 0,
    accuracy: attempt.accuracy || 0,
    timeTakenSeconds: attempt.timeTakenSeconds || 0,
    totalTimeSeconds: attempt.totalTimeSeconds || 0,
    negativeMarking: attempt.negativeMarking || false,
    negativeMarkValue: attempt.negativeMarkValue || 0,
    marksPerQuestion: attempt.marksPerQuestion || 1,
    completedAt: new Date().toISOString(),
  };
  await db.put(STORES.TEST_ATTEMPTS, record);
  return record;
}

export async function getAllTestAttempts() {
  const db = await getDB();
  return db.getAll(STORES.TEST_ATTEMPTS);
}

export async function getTestAttempt(id) {
  const db = await getDB();
  return db.get(STORES.TEST_ATTEMPTS, id);
}

export async function deleteTestAttempt(id) {
  const db = await getDB();
  await db.delete(STORES.TEST_ATTEMPTS, id);
}

// ============================================================
// Test Progress (Auto-save)
// ============================================================

export async function saveTestProgress(progress) {
  const db = await getDB();
  const record = {
    ...progress,
    savedAt: new Date().toISOString(),
  };
  await db.put(STORES.TEST_PROGRESS, record);
  return record;
}

export async function getTestProgress(id) {
  const db = await getDB();
  return db.get(STORES.TEST_PROGRESS, id);
}

export async function getAllTestProgress() {
  const db = await getDB();
  return db.getAll(STORES.TEST_PROGRESS);
}

export async function deleteTestProgress(id) {
  const db = await getDB();
  await db.delete(STORES.TEST_PROGRESS, id);
}

// ============================================================
// Import / Export
// ============================================================

export async function exportQuestionBank(id) {
  const bank = await getQuestionBank(id);
  if (!bank) throw new Error(`Question bank ${id} not found`);
  const exportData = {
    exportVersion: 1,
    exportedAt: new Date().toISOString(),
    type: 'questionBank',
    data: { ...bank },
  };
  // Remove internal id so it gets a new one on import
  delete exportData.data.id;
  return JSON.stringify(exportData, null, 2);
}

export async function importQuestionBank(jsonString) {
  let parsed;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error('Invalid JSON file');
  }

  if (!parsed.type || parsed.type !== 'questionBank' || !parsed.data) {
    throw new Error('Invalid question bank file format');
  }

  const bankData = parsed.data;
  if (!bankData.questions || !Array.isArray(bankData.questions)) {
    throw new Error('No questions found in the imported file');
  }

  // Create a new bank with fresh IDs
  return addQuestionBank({
    name: bankData.name || 'Imported Bank',
    description: bankData.description || '',
    tags: bankData.tags || [],
    questions: bankData.questions.map((q) => ({
      ...q,
      id: crypto.randomUUID(), // regenerate question IDs
    })),
  });
}

export { STORES };
