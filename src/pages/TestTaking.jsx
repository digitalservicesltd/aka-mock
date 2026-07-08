import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Clock,
  ChevronLeft,
  ChevronRight,
  Flag,
  RotateCcw,
  Send,
  AlertTriangle,
  BookmarkCheck,
} from 'lucide-react';
import { useTimer } from '../hooks/useTimer';
import { saveTestProgress, deleteTestProgress, addTestAttempt } from '../db/database';

export default function TestTakingPage() {
  const navigate = useNavigate();
  const { testId } = useParams();

  const [test, setTest] = useState(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState({});          // { questionId: 'A' }
  const [markedForReview, setMarkedForReview] = useState(new Set());
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const autoSaveRef = useRef(null);

  // Load test from sessionStorage
  useEffect(() => {
    const stored = sessionStorage.getItem('activeTest');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setTest(parsed);
      } catch {
        navigate('/test/config');
      }
    } else {
      navigate('/test/config');
    }
  }, [navigate]);

  // Timer — uses real timestamps, persists to localStorage
  const totalSeconds = test ? (test.config.timeLimitMinutes || 30) * 60 : 1800;
  const testTimerId = test?.id || 'default';

  const handleTimerExpiry = useCallback(() => {
    if (!submitted) {
      handleSubmit(true);
    }
  }, [submitted]);

  const {
    timeLeft,
    elapsed,
    formattedTimeLeft,
    isWarning,
    isDanger,
    start: startTimer,
    stop: stopTimer,
    getStartTimestamp,
    getRealElapsedMs,
  } = useTimer({
    durationSeconds: totalSeconds,
    timerId: testTimerId,
    onExpiry: handleTimerExpiry,
    autoStart: false,
  });

  // Start timer once test is loaded (or resume if already running from localStorage)
  useEffect(() => {
    if (test) {
      // Only start fresh if there's no persisted timer state
      const timerKey = `mocktest_timer_${testTimerId}`;
      const existing = localStorage.getItem(timerKey);
      if (!existing) {
        startTimer();
      }
    }
  }, [test]);

  // Beforeunload warning
  useEffect(() => {
    const handler = (e) => {
      if (!submitted) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [submitted]);

  // Auto-save progress periodically
  useEffect(() => {
    if (!test || submitted) return;

    autoSaveRef.current = setInterval(() => {
      saveTestProgress({
        id: test.id,
        testData: test,
        answers,
        markedForReview: [...markedForReview],
        currentIndex,
        timeLeft,
      }).catch(console.error);
    }, 10000); // every 10s

    return () => {
      if (autoSaveRef.current) clearInterval(autoSaveRef.current);
    };
  }, [test, answers, markedForReview, currentIndex, timeLeft, submitted]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (showSubmitModal) return;
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const question = test?.questions[currentIndex];
      if (!question) return;

      switch (e.key) {
        case '1':
        case '2':
        case '3':
        case '4': {
          const idx = parseInt(e.key) - 1;
          if (idx < question.options.length) {
            selectAnswer(question.id, question.options[idx].label);
          }
          break;
        }
        case 'a': case 'A':
          if (question.options.find(o => o.label === 'A')) selectAnswer(question.id, 'A');
          break;
        case 'b': case 'B':
          if (question.options.find(o => o.label === 'B')) selectAnswer(question.id, 'B');
          break;
        case 'c': case 'C':
          if (question.options.find(o => o.label === 'C')) selectAnswer(question.id, 'C');
          break;
        case 'd': case 'D':
          if (question.options.find(o => o.label === 'D')) selectAnswer(question.id, 'D');
          break;
        case 'n': case 'N':
        case 'ArrowRight':
          goNext();
          break;
        case 'p': case 'P':
        case 'ArrowLeft':
          goPrev();
          break;
        case 'm': case 'M':
          toggleMark(question.id);
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [test, currentIndex, showSubmitModal]);

  if (!test) {
    return (
      <div className="flex-center" style={{ height: '100vh' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  const questions = test.questions;
  const currentQuestion = questions[currentIndex];
  const totalQuestions = questions.length;

  const selectAnswer = (questionId, optionLabel) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionLabel }));
  };

  const clearAnswer = () => {
    if (currentQuestion) {
      setAnswers((prev) => {
        const next = { ...prev };
        delete next[currentQuestion.id];
        return next;
      });
    }
  };

  const toggleMark = (questionId) => {
    setMarkedForReview((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) next.delete(questionId);
      else next.add(questionId);
      return next;
    });
  };

  const goNext = () => {
    if (currentIndex < totalQuestions - 1) setCurrentIndex((i) => i + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const getQuestionStatus = (questionId) => {
    if (questionId === currentQuestion?.id) return 'current';
    if (markedForReview.has(questionId) && answers[questionId]) return 'marked';
    if (markedForReview.has(questionId)) return 'marked';
    if (answers[questionId]) return 'answered';
    return 'unanswered';
  };

  const answeredCount = Object.keys(answers).length;
  const unansweredCount = totalQuestions - answeredCount;
  const markedCount = markedForReview.size;

  const handleSubmit = async (isAutoSubmit = false) => {
    if (submitted) return;
    setSubmitted(true);
    setShowSubmitModal(false);

    const config = test.config;
    let score = 0;
    let correctCount = 0;
    let incorrectCount = 0;
    let unanswered = 0;

    const questionResults = questions.map((q) => {
      const userAnswer = answers[q.id] || null;
      const isCorrect = userAnswer && userAnswer === q.correctAnswer;
      const isWrong = userAnswer && userAnswer !== q.correctAnswer;

      if (!userAnswer) {
        unanswered++;
      } else if (isCorrect) {
        correctCount++;
        score += config.marksPerQuestion || 1;
      } else {
        incorrectCount++;
        if (config.negativeMarking) {
          score -= config.negativeMarkValue || 0.25;
        }
      }

      return {
        ...q,
        userAnswer,
        isCorrect: !!isCorrect,
      };
    });

    const maxScore = totalQuestions * (config.marksPerQuestion || 1);
    const accuracy = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Calculate real time taken from timestamps
    const realElapsedMs = getRealElapsedMs();
    const timeTaken = Math.round(realElapsedMs / 1000) || (totalSeconds - timeLeft);
    const timeRemaining = Math.max(0, totalSeconds - timeTaken);

    try {
      const attempt = await addTestAttempt({
        templateId: test.id,
        templateName: test.templateName,
        questions: questionResults,
        answers,
        markedForReview: [...markedForReview],
        score: Math.max(0, score),
        maxScore,
        totalQuestions,
        correctCount,
        incorrectCount,
        unansweredCount: unanswered,
        accuracy,
        timeTakenSeconds: timeTaken,
        totalTimeSeconds: totalSeconds,
        timeRemainingSeconds: timeRemaining,
        negativeMarking: config.negativeMarking,
        negativeMarkValue: config.negativeMarkValue,
        marksPerQuestion: config.marksPerQuestion,
      });

      // Clean up timer and progress
      stopTimer();
      await deleteTestProgress(test.id).catch(() => {});
      sessionStorage.removeItem('activeTest');

      navigate(`/test/results/${attempt.id}`);
    } catch (err) {
      console.error('Failed to save attempt:', err);
      setSubmitted(false);
    }
  };

  return (
    <div className="test-layout">
      {/* Main area */}
      <div className="test-main">
        {/* Top bar */}
        <div className="test-header">
          <div className="flex-row gap-4">
            <span style={{
              fontSize: 'var(--font-size-sm)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-text-secondary)',
            }}>
              {test.templateName}
            </span>
            <span className="badge badge-neutral">
              Q{currentIndex + 1}/{totalQuestions}
            </span>
          </div>

          <div className={`timer ${isWarning ? 'warning' : ''} ${isDanger ? 'danger' : ''}`}>
            <Clock size={18} />
            {formattedTimeLeft}
          </div>

          <button
            className="btn btn-primary btn-sm"
            onClick={() => setShowSubmitModal(true)}
          >
            <Send size={14} /> Submit
          </button>
        </div>

        {/* Question area */}
        <div className="test-question-area">
          {currentQuestion && (
            <div className="animate-fade-in" key={currentQuestion.id} style={{ maxWidth: 800 }}>
              {/* Question header */}
              <div className="flex-between" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="flex-row gap-2">
                  <span style={{
                    fontSize: 'var(--font-size-2xl)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: 'var(--color-accent)',
                  }}>
                    Q{currentIndex + 1}
                  </span>
                  {markedForReview.has(currentQuestion.id) && (
                    <span className="badge badge-warning">
                      <Flag size={12} /> Marked for review
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                }}>
                  {test.config.marksPerQuestion || 1} mark{(test.config.marksPerQuestion || 1) !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Question text */}
              <p style={{
                fontSize: 'var(--font-size-lg)',
                lineHeight: 'var(--line-height-relaxed)',
                marginBottom: 'var(--space-8)',
                color: 'var(--color-text-primary)',
              }}>
                {currentQuestion.questionText}
              </p>

              {/* Options */}
              <div className="flex-col gap-3">
                {currentQuestion.options.map((option, idx) => {
                  const isSelected = answers[currentQuestion.id] === option.label;

                  return (
                    <div
                      key={option.label}
                      className={`option-card ${isSelected ? 'selected' : ''}`}
                      onClick={() => selectAnswer(currentQuestion.id, option.label)}
                    >
                      <div className="option-letter">{option.label}</div>
                      <div style={{
                        flex: 1,
                        fontSize: 'var(--font-size-base)',
                        lineHeight: 'var(--line-height-relaxed)',
                        paddingTop: 'var(--space-1)',
                      }}>
                        {option.text}
                      </div>
                      <span style={{
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-muted)',
                        opacity: 0.6,
                      }}>
                        {idx + 1}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Keyboard shortcut hint */}
              <p style={{
                marginTop: 'var(--space-6)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--color-text-muted)',
              }}>
                Keyboard: Press 1-4 or A-D to select • N/→ next • P/← prev • M mark for review
              </p>
            </div>
          )}
        </div>

        {/* Bottom controls */}
        <div className="test-controls">
          <div className="flex-row gap-2">
            <button
              className="btn btn-secondary btn-sm"
              onClick={goPrev}
              disabled={currentIndex === 0}
            >
              <ChevronLeft size={16} /> Previous
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={goNext}
              disabled={currentIndex === totalQuestions - 1}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          <div className="flex-row gap-2">
            <button className="btn btn-ghost btn-sm" onClick={clearAnswer}>
              <RotateCcw size={14} /> Clear
            </button>
            <button
              className={`btn btn-sm ${markedForReview.has(currentQuestion?.id) ? 'btn-secondary' : 'btn-ghost'}`}
              onClick={() => currentQuestion && toggleMark(currentQuestion.id)}
              style={markedForReview.has(currentQuestion?.id) ? {
                borderColor: 'var(--color-warning)',
                color: 'var(--color-warning)',
              } : {}}
            >
              <Flag size={14} />
              {markedForReview.has(currentQuestion?.id) ? 'Marked' : 'Mark for Review'}
            </button>
          </div>
        </div>
      </div>

      {/* Right sidebar — Question navigator */}
      <div className="test-sidebar">
        <div style={{
          padding: 'var(--space-4)',
          borderBottom: '1px solid var(--color-surface-border)',
        }}>
          <h5 style={{ marginBottom: 'var(--space-3)' }}>Question Navigator</h5>
          <div className="flex-row gap-4 flex-wrap" style={{ fontSize: 'var(--font-size-xs)' }}>
            <div className="flex-row gap-1">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--color-success-muted)', border: '1px solid var(--color-success)' }} />
              <span style={{ color: 'var(--color-text-tertiary)' }}>Answered ({answeredCount})</span>
            </div>
            <div className="flex-row gap-1">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--color-bg-tertiary)', border: '1px solid var(--color-surface-border)' }} />
              <span style={{ color: 'var(--color-text-tertiary)' }}>Unanswered ({unansweredCount})</span>
            </div>
            <div className="flex-row gap-1">
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'var(--color-warning-muted)', border: '1px solid var(--color-warning)' }} />
              <span style={{ color: 'var(--color-text-tertiary)' }}>Marked ({markedCount})</span>
            </div>
          </div>
        </div>

        <div className="question-nav-grid" style={{ flex: 1, overflowY: 'auto', alignContent: 'flex-start' }}>
          {questions.map((q, idx) => {
            const status = getQuestionStatus(q.id);
            return (
              <button
                key={q.id}
                className={`question-nav-btn ${status}`}
                onClick={() => setCurrentIndex(idx)}
              >
                {idx + 1}
              </button>
            );
          })}
        </div>
      </div>

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <div className="modal-overlay" onClick={() => setShowSubmitModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Submit Test?</h3>
            </div>

            <div style={{ marginBottom: 'var(--space-6)' }}>
              {unansweredCount > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
                  padding: 'var(--space-3) var(--space-4)',
                  background: 'var(--color-warning-bg)',
                  border: '1px solid var(--color-warning-muted)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: 'var(--space-4)',
                  color: 'var(--color-warning)',
                  fontSize: 'var(--font-size-sm)',
                }}>
                  <AlertTriangle size={16} />
                  You have {unansweredCount} unanswered question{unansweredCount !== 1 ? 's' : ''}
                </div>
              )}

              <div className="flex-col gap-2" style={{ fontSize: 'var(--font-size-sm)' }}>
                <div className="flex-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Answered</span>
                  <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-success)' }}>
                    {answeredCount}
                  </span>
                </div>
                <div className="flex-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Unanswered</span>
                  <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-text-tertiary)' }}>
                    {unansweredCount}
                  </span>
                </div>
                <div className="flex-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Marked for review</span>
                  <span style={{ fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-warning)' }}>
                    {markedCount}
                  </span>
                </div>
                <div className="flex-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>Time remaining</span>
                  <span style={{ fontWeight: 'var(--font-weight-semibold)' }}>{formattedTimeLeft}</span>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowSubmitModal(false)}>
                Continue Test
              </button>
              <button className="btn btn-primary" onClick={() => handleSubmit(false)}>
                <Send size={16} /> Submit Test
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
