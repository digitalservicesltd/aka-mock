import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router';
import {
  Trophy,
  Target,
  Clock,
  CheckCircle2,
  XCircle,
  MinusCircle,
  ArrowLeft,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Home,
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { getTestAttempt } from '../db/database';

export default function ResultsPage() {
  const navigate = useNavigate();
  const { attemptId } = useParams();
  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedQuestion, setExpandedQuestion] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all' | 'correct' | 'incorrect' | 'unanswered'

  useEffect(() => {
    loadAttempt();
  }, [attemptId]);

  async function loadAttempt() {
    try {
      const data = await getTestAttempt(attemptId);
      if (data) {
        setAttempt(data);
      }
    } catch (err) {
      console.error('Failed to load attempt:', err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-center" style={{ height: '100vh' }}>
        <div className="spinner-lg" />
      </div>
    );
  }

  if (!attempt) {
    return (
      <>
        <Header title="Results" />
        <div className="app-content">
          <div className="empty-state">
            <Trophy size={48} />
            <h3>Result Not Found</h3>
            <p>This test attempt could not be found.</p>
            <button className="btn btn-primary" onClick={() => navigate('/library')} style={{ marginTop: 'var(--space-4)' }}>
              Go to Library
            </button>
          </div>
        </div>
      </>
    );
  }

  const {
    score, maxScore, totalQuestions, correctCount, incorrectCount,
    unansweredCount, accuracy, timeTakenSeconds, totalTimeSeconds,
    timeRemainingSeconds, questions,
    templateName, completedAt, negativeMarking, negativeMarkValue,
    marksPerQuestion,
  } = attempt;

  // Calculate time remaining if not stored (backward compat)
  const timeRemaining = timeRemainingSeconds ?? Math.max(0, (totalTimeSeconds || 0) - (timeTakenSeconds || 0));

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainMins = mins % 60;
      return `${hrs}h ${remainMins}m ${secs}s`;
    }
    return `${mins}m ${secs}s`;
  };

  const scorePercent = maxScore > 0 ? (score / maxScore) * 100 : 0;
  const circumference = 2 * Math.PI * 88; // r=88 for 200x200 circle
  const strokeDashoffset = circumference - (circumference * Math.min(scorePercent, 100)) / 100;

  const scoreColor = accuracy >= 70 ? 'var(--color-success)' : accuracy >= 40 ? 'var(--color-warning)' : 'var(--color-error)';

  // Filter questions
  const filteredQuestions = (questions || []).filter((q) => {
    if (filter === 'all') return true;
    if (filter === 'correct') return q.isCorrect;
    if (filter === 'incorrect') return q.userAnswer && !q.isCorrect;
    if (filter === 'unanswered') return !q.userAnswer;
    return true;
  });

  return (
    <>
      <Header title="Test Results" subtitle={templateName}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
          <Home size={16} /> Dashboard
        </button>
      </Header>

      <div className="app-content">
        {/* Score Card */}
        <div className="card card-glow animate-fade-in" style={{
          textAlign: 'center',
          padding: 'var(--space-10)',
          marginBottom: 'var(--space-8)',
          background: 'linear-gradient(135deg, rgba(26, 32, 53, 0.9) 0%, rgba(17, 24, 39, 0.9) 100%)',
        }}>
          {/* Score circle */}
          <div className="score-circle" style={{ margin: '0 auto var(--space-6)' }}>
            <svg viewBox="0 0 200 200">
              <circle className="score-bg" cx="100" cy="100" r="88" />
              <circle
                className="score-fill"
                cx="100" cy="100" r="88"
                style={{
                  stroke: scoreColor,
                  strokeDasharray: circumference,
                  strokeDashoffset,
                }}
              />
            </svg>
            <div className="score-value" style={{ color: scoreColor }}>
              {Math.round(accuracy)}%
            </div>
            <div className="score-label">Accuracy</div>
          </div>

          <h2 style={{ marginBottom: 'var(--space-2)' }}>
            {accuracy >= 80 ? '🎉 Excellent!' :
             accuracy >= 60 ? '👍 Good Job!' :
             accuracy >= 40 ? '📚 Keep Practicing' :
             '💪 Don\'t Give Up!'}
          </h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 'var(--space-6)' }}>
            {templateName} · {new Date(completedAt).toLocaleDateString(undefined, {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
            })}
          </p>

          {/* Stats grid */}
          <div className="grid grid-4" style={{ maxWidth: 600, margin: '0 auto', gap: 'var(--space-4)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-2)',
              }}>
                <Trophy size={22} color="#6366f1" />
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {score}/{maxScore}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Score</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: 'var(--color-success-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-2)',
              }}>
                <CheckCircle2 size={22} color="var(--color-success)" />
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-success)' }}>
                {correctCount}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Correct</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: 'var(--color-error-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-2)',
              }}>
                <XCircle size={22} color="var(--color-error)" />
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)', color: 'var(--color-error)' }}>
                {incorrectCount}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Incorrect</div>
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                background: 'rgba(99, 102, 241, 0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto var(--space-2)',
              }}>
                <Clock size={22} color="#6366f1" />
              </div>
              <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 'var(--font-weight-bold)' }}>
                {formatTime(timeTakenSeconds)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Time Taken</div>
            </div>
          </div>

          {/* Time breakdown row */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 'var(--space-8)',
            marginTop: 'var(--space-5)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'rgba(99, 102, 241, 0.06)',
            borderRadius: 'var(--radius-md)',
            maxWidth: 500,
            margin: 'var(--space-5) auto 0',
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)' }}>
                {formatTime(totalTimeSeconds || 0)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Total Allowed</div>
            </div>
            <div style={{ width: 1, background: 'var(--color-surface-border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: 'var(--color-accent)' }}>
                {formatTime(timeTakenSeconds)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Time Taken</div>
            </div>
            <div style={{ width: 1, background: 'var(--color-surface-border)' }} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 'var(--font-weight-semibold)', color: timeRemaining > 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                {formatTime(timeRemaining)}
              </div>
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>Time Remaining</div>
            </div>
          </div>

          {negativeMarking && (
            <div style={{
              marginTop: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
              color: 'var(--color-text-tertiary)',
            }}>
              <MinusCircle size={12} style={{ verticalAlign: -2 }} /> Negative marking: -{negativeMarkValue} per wrong answer
            </div>
          )}
        </div>

        {/* Question Review */}
        <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
          <h3>
            <BarChart3 size={20} style={{ verticalAlign: -4, marginRight: 8 }} />
            Question Review
          </h3>
          <div className="tabs" style={{ maxWidth: 420 }}>
            {[
              { key: 'all', label: `All (${totalQuestions})` },
              { key: 'correct', label: `✓ (${correctCount})` },
              { key: 'incorrect', label: `✗ (${incorrectCount})` },
              { key: 'unanswered', label: `— (${unansweredCount})` },
            ].map((f) => (
              <button
                key={f.key}
                className={`tab ${filter === f.key ? 'active' : ''}`}
                onClick={() => setFilter(f.key)}
                style={{ padding: 'var(--space-2) var(--space-3)', fontSize: 'var(--font-size-xs)' }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-col gap-3" style={{ marginBottom: 'var(--space-8)' }}>
          {filteredQuestions.map((q, idx) => {
            const isExpanded = expandedQuestion === q.id;
            const originalIndex = (questions || []).findIndex(oq => oq.id === q.id);

            return (
              <div
                key={q.id}
                className="card animate-fade-in-up"
                style={{
                  borderLeftWidth: 3,
                  borderLeftColor: q.isCorrect
                    ? 'var(--color-success)'
                    : q.userAnswer
                      ? 'var(--color-error)'
                      : 'var(--color-text-muted)',
                }}
              >
                <div
                  className="flex-between pointer"
                  onClick={() => setExpandedQuestion(isExpanded ? null : q.id)}
                >
                  <div className="flex-row gap-3" style={{ flex: 1, minWidth: 0 }}>
                    <span style={{
                      width: 32, height: 32, borderRadius: 'var(--radius-md)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: q.isCorrect
                        ? 'var(--color-success-muted)'
                        : q.userAnswer
                          ? 'var(--color-error-muted)'
                          : 'rgba(100,116,139,0.15)',
                      flexShrink: 0,
                    }}>
                      {q.isCorrect ? (
                        <CheckCircle2 size={16} color="var(--color-success)" />
                      ) : q.userAnswer ? (
                        <XCircle size={16} color="var(--color-error)" />
                      ) : (
                        <MinusCircle size={16} color="var(--color-text-muted)" />
                      )}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex-row gap-2" style={{ marginBottom: 2 }}>
                        <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>
                          Q{originalIndex + 1}
                        </span>
                        {q.isCorrect && <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>Correct</span>}
                        {q.userAnswer && !q.isCorrect && <span className="badge badge-error" style={{ fontSize: '0.65rem' }}>Incorrect</span>}
                        {!q.userAnswer && <span className="badge badge-neutral" style={{ fontSize: '0.65rem' }}>Skipped</span>}
                      </div>
                      <p className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)' }}>
                        {q.questionText}
                      </p>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>

                {isExpanded && (
                  <div className="animate-fade-in" style={{
                    marginTop: 'var(--space-4)',
                    paddingTop: 'var(--space-4)',
                    borderTop: '1px solid var(--color-surface-border)',
                  }}>
                    <p style={{
                      fontSize: 'var(--font-size-base)',
                      lineHeight: 'var(--line-height-relaxed)',
                      marginBottom: 'var(--space-4)',
                    }}>
                      {q.questionText}
                    </p>

                    <div className="flex-col gap-2">
                      {(q.options || []).map((opt) => {
                        const isUserAnswer = q.userAnswer === opt.label;
                        const isCorrectAnswer = q.correctAnswer === opt.label;
                        let className = 'option-card';

                        if (isCorrectAnswer) className += ' correct';
                        else if (isUserAnswer && !q.isCorrect) className += ' incorrect';

                        return (
                          <div key={opt.label} className={className} style={{ cursor: 'default' }}>
                            <div className="option-letter">{opt.label}</div>
                            <div style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>
                              {opt.text}
                            </div>
                            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                              {isCorrectAnswer && '✓ Correct'}
                              {isUserAnswer && !isCorrectAnswer && '✗ Your answer'}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {!q.userAnswer && (
                      <p style={{
                        marginTop: 'var(--space-3)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--color-text-muted)',
                      }}>
                        You did not answer this question
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom actions */}
        <div className="flex-row gap-3" style={{ justifyContent: 'center', paddingBottom: 'var(--space-8)' }}>
          <button className="btn btn-secondary" onClick={() => navigate('/library')}>
            <ArrowLeft size={16} /> Back to Library
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/test/config')}>
            <RotateCcw size={16} /> Take Another Test
          </button>
        </div>
      </div>
    </>
  );
}
