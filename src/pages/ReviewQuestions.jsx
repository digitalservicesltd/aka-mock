import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Save,
  Trash2,
  Plus,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Merge,
  Scissors,
  Tag,
  ArrowLeft,
  AlertCircle,
  X,
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { addQuestionBank } from '../db/database';

export default function ReviewQuestions() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [warnings, setWarnings] = useState([]);
  const [bankName, setBankName] = useState('');
  const [bankDescription, setBankDescription] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());

  useEffect(() => {
    const stored = sessionStorage.getItem('parsedQuestions');
    const storedWarnings = sessionStorage.getItem('parseWarnings');

    if (stored) {
      try {
        setQuestions(JSON.parse(stored));
      } catch {
        setError('Failed to load parsed questions');
      }
    } else {
      setError('No parsed questions found. Please go back and upload/paste text first.');
    }

    if (storedWarnings) {
      try {
        setWarnings(JSON.parse(storedWarnings));
      } catch { /* ignore */ }
    }
  }, []);

  const updateQuestion = (id, field, value) => {
    setQuestions((prev) =>
      prev.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const updateOption = (questionId, optionIndex, value) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const newOptions = [...q.options];
        newOptions[optionIndex] = { ...newOptions[optionIndex], text: value };
        return { ...q, options: newOptions };
      })
    );
  };

  const addOption = (questionId) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const labels = 'ABCDEFGHIJ';
        const newLabel = labels[q.options.length] || `${q.options.length + 1}`;
        return {
          ...q,
          options: [...q.options, { label: newLabel, text: '' }],
        };
      })
    );
  };

  const removeOption = (questionId, optionIndex) => {
    setQuestions((prev) =>
      prev.map((q) => {
        if (q.id !== questionId) return q;
        const newOptions = q.options.filter((_, i) => i !== optionIndex);
        // Fix labels
        const labels = 'ABCDEFGHIJ';
        const relabeled = newOptions.map((o, i) => ({ ...o, label: labels[i] || `${i + 1}` }));
        // Fix correctAnswer if the removed option was the correct one
        let newCorrect = q.correctAnswer;
        if (q.correctAnswer === q.options[optionIndex]?.label) {
          newCorrect = null;
        }
        return { ...q, options: relabeled, correctAnswer: newCorrect };
      })
    );
  };

  const deleteQuestion = (id) => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => q.id !== id);
      return filtered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const deleteSelected = () => {
    setQuestions((prev) => {
      const filtered = prev.filter((q) => !selectedIds.has(q.id));
      return filtered.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
    setSelectedIds(new Set());
  };

  const mergeWithNext = (id) => {
    setQuestions((prev) => {
      const idx = prev.findIndex((q) => q.id === id);
      if (idx < 0 || idx >= prev.length - 1) return prev;

      const current = prev[idx];
      const next = prev[idx + 1];

      const merged = {
        ...current,
        questionText: `${current.questionText}\n${next.questionText}`,
        options: current.options.length > 0 ? current.options : next.options,
        correctAnswer: current.correctAnswer || next.correctAnswer,
      };

      const newQuestions = [...prev];
      newQuestions[idx] = merged;
      newQuestions.splice(idx + 1, 1);
      return newQuestions.map((q, i) => ({ ...q, questionNumber: i + 1 }));
    });
  };

  const addNewQuestion = () => {
    const newQ = {
      id: crypto.randomUUID(),
      questionNumber: questions.length + 1,
      questionText: '',
      options: [
        { label: 'A', text: '' },
        { label: 'B', text: '' },
        { label: 'C', text: '' },
        { label: 'D', text: '' },
      ],
      correctAnswer: null,
      tags: [],
      difficulty: 'medium',
      confidence: 'high',
    };
    setQuestions((prev) => [...prev, newQ]);
    setExpandedId(newQ.id);
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === questions.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(questions.map((q) => q.id)));
    }
  };

  const saveToLibrary = async () => {
    if (!bankName.trim()) {
      setError('Please enter a name for this question bank');
      return;
    }

    if (questions.length === 0) {
      setError('No questions to save');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const bank = await addQuestionBank({
        name: bankName.trim(),
        description: bankDescription.trim(),
        questions: questions.map((q) => ({
          id: q.id,
          questionText: q.questionText,
          options: q.options,
          correctAnswer: q.correctAnswer,
          tags: q.tags,
          difficulty: q.difficulty,
        })),
      });

      // Clean up session storage
      sessionStorage.removeItem('parsedQuestions');
      sessionStorage.removeItem('parseWarnings');
      sessionStorage.removeItem('rawText');

      navigate('/library');
    } catch (err) {
      setError(`Failed to save: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const getConfidenceBadge = (confidence) => {
    switch (confidence) {
      case 'high':
        return <span className="badge badge-success">High confidence</span>;
      case 'medium':
        return <span className="badge badge-warning">Medium confidence</span>;
      case 'low':
        return <span className="badge badge-error">Low confidence — review needed</span>;
      default:
        return null;
    }
  };

  return (
    <>
      <Header title="Review Questions" subtitle={`${questions.length} questions detected`}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/upload')}>
          <ArrowLeft size={16} /> Back
        </button>
      </Header>

      <div className="app-content">
        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="animate-fade-in" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-warning-bg)',
            border: '1px solid var(--color-warning-muted)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-6)',
          }}>
            <AlertTriangle size={18} color="var(--color-warning)" style={{ flexShrink: 0, marginTop: 1 }} />
            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--color-warning)' }}>
              {warnings.map((w, i) => <div key={i}>{w}</div>)}
            </div>
          </div>
        )}

        {error && (
          <div className="animate-fade-in" style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--space-3)',
            padding: 'var(--space-4)',
            background: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-muted)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: 'var(--space-6)',
            color: 'var(--color-error)',
            fontSize: 'var(--font-size-sm)',
          }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            <div>{error}</div>
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {/* Bank name + save controls */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="grid grid-2" style={{ gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
            <div className="input-group">
              <label>Question Bank Name *</label>
              <input
                className="input"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g., Physics Chapter 3"
              />
            </div>
            <div className="input-group">
              <label>Description (optional)</label>
              <input
                className="input"
                value={bankDescription}
                onChange={(e) => setBankDescription(e.target.value)}
                placeholder="Brief description of this question set"
              />
            </div>
          </div>

          <div className="flex-between">
            <div className="flex-row gap-3">
              {selectedIds.size > 0 && (
                <button className="btn btn-danger btn-sm" onClick={deleteSelected}>
                  <Trash2 size={14} />
                  Delete {selectedIds.size} selected
                </button>
              )}
              <label className="checkbox-wrapper" style={{ fontSize: 'var(--font-size-sm)' }}>
                <input
                  type="checkbox"
                  checked={selectedIds.size === questions.length && questions.length > 0}
                  onChange={toggleSelectAll}
                />
                Select all
              </label>
            </div>
            <div className="flex-row gap-3">
              <button className="btn btn-secondary btn-sm" onClick={addNewQuestion}>
                <Plus size={14} /> Add Question
              </button>
              <button
                className="btn btn-primary"
                onClick={saveToLibrary}
                disabled={saving || !bankName.trim() || questions.length === 0}
              >
                <Save size={16} />
                {saving ? 'Saving...' : 'Save to Library'}
              </button>
            </div>
          </div>
        </div>

        {/* Question list */}
        <div className="flex-col gap-4">
          {questions.map((q, idx) => {
            const isExpanded = expandedId === q.id;

            return (
              <div
                key={q.id}
                className="card animate-fade-in"
                style={{
                  borderColor: q.confidence === 'low' ? 'var(--color-error-muted)' : undefined,
                }}
              >
                {/* Question header */}
                <div className="flex-between" style={{ marginBottom: isExpanded ? 'var(--space-4)' : 0 }}>
                  <div className="flex-row gap-3" style={{ flex: 1, minWidth: 0 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(q.id)}
                      onChange={() => toggleSelect(q.id)}
                      style={{ width: 18, height: 18, cursor: 'pointer', flexShrink: 0 }}
                    />
                    <div
                      className="pointer flex-1"
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                      style={{ minWidth: 0 }}
                    >
                      <div className="flex-row gap-2" style={{ marginBottom: 'var(--space-1)' }}>
                        <span className="badge badge-neutral">Q{q.questionNumber}</span>
                        {getConfidenceBadge(q.confidence)}
                        {q.correctAnswer && (
                          <span className="badge badge-success">
                            <CheckCircle2 size={12} /> Ans: {q.correctAnswer}
                          </span>
                        )}
                        {!q.correctAnswer && (
                          <span className="badge badge-warning">No answer</span>
                        )}
                        <span className="badge badge-neutral">{q.options.length} options</span>
                      </div>
                      <p className="truncate" style={{
                        fontSize: 'var(--font-size-sm)',
                        color: 'var(--color-text-secondary)',
                      }}>
                        {q.questionText || 'Empty question text'}
                      </p>
                    </div>
                  </div>

                  <div className="flex-row gap-1">
                    {idx < questions.length - 1 && (
                      <button
                        className="btn btn-ghost btn-icon btn-sm tooltip"
                        onClick={() => mergeWithNext(q.id)}
                        data-tooltip="Merge with next"
                      >
                        <Merge size={14} />
                      </button>
                    )}
                    <button
                      className="btn btn-ghost btn-icon btn-sm tooltip"
                      onClick={() => deleteQuestion(q.id)}
                      data-tooltip="Delete"
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => setExpandedId(isExpanded ? null : q.id)}
                    >
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                  </div>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <div className="animate-fade-in" style={{
                    borderTop: '1px solid var(--color-surface-border)',
                    paddingTop: 'var(--space-4)',
                  }}>
                    {/* Question text */}
                    <div className="input-group" style={{ marginBottom: 'var(--space-4)' }}>
                      <label>Question Text</label>
                      <textarea
                        className="input"
                        value={q.questionText}
                        onChange={(e) => updateQuestion(q.id, 'questionText', e.target.value)}
                        style={{ minHeight: 80 }}
                      />
                    </div>

                    {/* Options */}
                    <div style={{ marginBottom: 'var(--space-4)' }}>
                      <label style={{
                        fontSize: 'var(--font-size-sm)',
                        fontWeight: 'var(--font-weight-medium)',
                        color: 'var(--color-text-secondary)',
                        display: 'block',
                        marginBottom: 'var(--space-2)',
                      }}>
                        Options
                      </label>
                      <div className="flex-col gap-2">
                        {q.options.map((opt, oi) => (
                          <div key={oi} className="flex-row gap-2">
                            <span style={{
                              width: 32,
                              height: 36,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: q.correctAnswer === opt.label
                                ? 'var(--color-success-muted)'
                                : 'var(--color-bg-tertiary)',
                              borderRadius: 'var(--radius-md)',
                              fontSize: 'var(--font-size-sm)',
                              fontWeight: 'var(--font-weight-semibold)',
                              color: q.correctAnswer === opt.label
                                ? 'var(--color-success)'
                                : 'var(--color-text-secondary)',
                              flexShrink: 0,
                            }}>
                              {opt.label}
                            </span>
                            <input
                              className="input input-sm"
                              value={opt.text}
                              onChange={(e) => updateOption(q.id, oi, e.target.value)}
                              placeholder={`Option ${opt.label}`}
                              style={{ flex: 1 }}
                            />
                            <button
                              className="btn btn-ghost btn-icon btn-sm"
                              onClick={() => removeOption(q.id, oi)}
                              style={{ width: 28, height: 28 }}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => addOption(q.id)}
                          style={{ alignSelf: 'flex-start' }}
                        >
                          <Plus size={14} /> Add Option
                        </button>
                      </div>
                    </div>

                    {/* Correct answer + metadata */}
                    <div className="grid grid-3" style={{ gap: 'var(--space-4)' }}>
                      <div className="input-group">
                        <label>Correct Answer</label>
                        <select
                          className="input select input-sm"
                          value={q.correctAnswer || ''}
                          onChange={(e) => updateQuestion(q.id, 'correctAnswer', e.target.value || null)}
                        >
                          <option value="">Not set</option>
                          {q.options.map((opt) => (
                            <option key={opt.label} value={opt.label}>
                              {opt.label}) {opt.text.substring(0, 40)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Difficulty</label>
                        <select
                          className="input select input-sm"
                          value={q.difficulty}
                          onChange={(e) => updateQuestion(q.id, 'difficulty', e.target.value)}
                        >
                          <option value="easy">Easy</option>
                          <option value="medium">Medium</option>
                          <option value="hard">Hard</option>
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Tags (comma separated)</label>
                        <input
                          className="input input-sm"
                          value={(q.tags || []).join(', ')}
                          onChange={(e) =>
                            updateQuestion(
                              q.id,
                              'tags',
                              e.target.value.split(',').map((t) => t.trim()).filter(Boolean)
                            )
                          }
                          placeholder="e.g., physics, kinematics"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {questions.length === 0 && (
          <div className="empty-state">
            <AlertTriangle size={48} />
            <h3>No Questions Found</h3>
            <p>No questions were detected. Go back to upload or paste text.</p>
            <button
              className="btn btn-primary"
              onClick={() => navigate('/upload')}
              style={{ marginTop: 'var(--space-4)' }}
            >
              <ArrowLeft size={16} /> Back to Upload
            </button>
          </div>
        )}
      </div>
    </>
  );
}
