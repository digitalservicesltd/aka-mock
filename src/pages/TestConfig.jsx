import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  Play,
  Save,
  Clock,
  Shuffle,
  MinusCircle,
  BookOpen,
  Settings2,
  ChevronDown,
  AlertCircle,
} from 'lucide-react';
import Header from '../components/Layout/Header';
import {
  getAllQuestionBanks,
  getTestTemplate,
  addTestTemplate,
  getQuestionBank,
} from '../db/database';

export default function TestConfigPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedBankId = searchParams.get('bankId');
  const templateId = searchParams.get('templateId');

  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Config state
  const [config, setConfig] = useState({
    name: '',
    bankIds: [],
    questionCount: 10,
    timeLimitMinutes: 30,
    shuffleQuestions: true,
    shuffleOptions: false,
    negativeMarking: false,
    negativeMarkValue: 0.25,
    marksPerQuestion: 1,
  });

  const [availableQuestions, setAvailableQuestions] = useState(0);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const allBanks = await getAllQuestionBanks();
      setBanks(allBanks);

      if (templateId) {
        const tmpl = await getTestTemplate(templateId);
        if (tmpl) {
          setConfig({
            name: tmpl.name,
            bankIds: tmpl.bankIds,
            questionCount: tmpl.questionCount,
            timeLimitMinutes: tmpl.timeLimitMinutes,
            shuffleQuestions: tmpl.shuffleQuestions,
            shuffleOptions: tmpl.shuffleOptions,
            negativeMarking: tmpl.negativeMarking,
            negativeMarkValue: tmpl.negativeMarkValue,
            marksPerQuestion: tmpl.marksPerQuestion,
          });
        }
      } else if (preselectedBankId) {
        setConfig((prev) => ({ ...prev, bankIds: [preselectedBankId] }));
      }
    } catch (err) {
      setError('Failed to load question banks');
    } finally {
      setLoading(false);
    }
  }

  // Recalculate available questions when banks change
  useEffect(() => {
    const total = banks
      .filter((b) => config.bankIds.includes(b.id))
      .reduce((sum, b) => sum + (b.questionCount || 0), 0);
    setAvailableQuestions(total);
  }, [config.bankIds, banks]);

  const toggleBank = (bankId) => {
    setConfig((prev) => ({
      ...prev,
      bankIds: prev.bankIds.includes(bankId)
        ? prev.bankIds.filter((id) => id !== bankId)
        : [...prev.bankIds, bankId],
    }));
  };

  const handleSaveTemplate = async () => {
    if (!config.name.trim()) {
      setError('Please enter a template name');
      return;
    }
    try {
      await addTestTemplate(config);
      navigate('/library');
    } catch (err) {
      setError(`Failed to save template: ${err.message}`);
    }
  };

  const handleStartTest = async () => {
    if (config.bankIds.length === 0) {
      setError('Please select at least one question bank');
      return;
    }

    if (availableQuestions === 0) {
      setError('Selected banks have no questions');
      return;
    }

    // Gather all questions from selected banks
    let allQuestions = [];
    for (const bankId of config.bankIds) {
      const bank = await getQuestionBank(bankId);
      if (bank?.questions) {
        allQuestions = [...allQuestions, ...bank.questions];
      }
    }

    // Shuffle if needed
    if (config.shuffleQuestions) {
      allQuestions = shuffleArray(allQuestions);
    }

    // Limit question count
    const count = Math.min(config.questionCount, allQuestions.length);
    allQuestions = allQuestions.slice(0, count);

    // Shuffle options if needed
    if (config.shuffleOptions) {
      allQuestions = allQuestions.map((q) => ({
        ...q,
        options: shuffleArray([...q.options]),
      }));
    }

    // Create test instance in sessionStorage
    const testInstance = {
      id: crypto.randomUUID(),
      templateName: config.name || 'Custom Test',
      questions: allQuestions,
      config: {
        timeLimitMinutes: config.timeLimitMinutes,
        negativeMarking: config.negativeMarking,
        negativeMarkValue: config.negativeMarkValue,
        marksPerQuestion: config.marksPerQuestion,
      },
      startedAt: new Date().toISOString(),
    };

    sessionStorage.setItem('activeTest', JSON.stringify(testInstance));
    navigate(`/test/take/${testInstance.id}`);
  };

  function shuffleArray(arr) {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  const updateConfig = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <>
      <Header title="Test Configuration" subtitle="Set up your mock test" />

      <div className="app-content" style={{ maxWidth: 800 }}>
        {error && (
          <div className="animate-fade-in" style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-error-bg)', border: '1px solid var(--color-error-muted)',
            borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-6)',
            color: 'var(--color-error)', fontSize: 'var(--font-size-sm)',
          }}>
            <AlertCircle size={16} /><span>{error}</span>
          </div>
        )}

        {/* Template Name */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="input-group">
            <label>Test Name</label>
            <input
              className="input"
              value={config.name}
              onChange={(e) => updateConfig('name', e.target.value)}
              placeholder="e.g., Physics Final Mock Test"
            />
          </div>
        </div>

        {/* Question Bank Selection */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex-row gap-2" style={{ marginBottom: 'var(--space-4)' }}>
            <BookOpen size={20} color="var(--color-accent)" />
            <h4>Question Banks</h4>
          </div>

          {banks.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: 'var(--space-8)',
              color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)',
            }}>
              No question banks available. Upload questions first.
            </div>
          ) : (
            <div className="flex-col gap-2">
              {banks.map((bank) => (
                <label
                  key={bank.id}
                  className="checkbox-wrapper"
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    background: config.bankIds.includes(bank.id)
                      ? 'var(--color-accent-muted)'
                      : 'var(--color-bg-tertiary)',
                    borderRadius: 'var(--radius-md)',
                    border: `1px solid ${config.bankIds.includes(bank.id)
                      ? 'var(--color-accent)'
                      : 'var(--color-surface-border)'}`,
                    transition: 'all var(--transition-fast)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={config.bankIds.includes(bank.id)}
                    onChange={() => toggleBank(bank.id)}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                      {bank.name}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {bank.questionCount} questions
                    </div>
                  </div>
                </label>
              ))}
            </div>
          )}

          {config.bankIds.length > 0 && (
            <div style={{
              marginTop: 'var(--space-3)', padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-accent-muted)', borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-size-xs)', color: 'var(--color-accent-hover)',
              fontWeight: 'var(--font-weight-medium)',
            }}>
              {availableQuestions} questions available from {config.bankIds.length} bank(s)
            </div>
          )}
        </div>

        {/* Test Settings */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex-row gap-2" style={{ marginBottom: 'var(--space-6)' }}>
            <Settings2 size={20} color="var(--color-accent)" />
            <h4>Test Settings</h4>
          </div>

          <div className="grid grid-2" style={{ gap: 'var(--space-6)' }}>
            {/* Question Count */}
            <div className="input-group">
              <label>Number of Questions</label>
              <div className="flex-row gap-3">
                <input
                  type="range"
                  min={1}
                  max={Math.max(availableQuestions, 1)}
                  value={Math.min(config.questionCount, availableQuestions || 1)}
                  onChange={(e) => updateConfig('questionCount', parseInt(e.target.value))}
                  style={{ flex: 1 }}
                />
                <input
                  type="number"
                  className="input input-sm"
                  value={config.questionCount}
                  onChange={(e) => updateConfig('questionCount', parseInt(e.target.value) || 1)}
                  min={1}
                  max={availableQuestions || 999}
                  style={{ width: 70 }}
                />
              </div>
            </div>

            {/* Time Limit */}
            <div className="input-group">
              <label>
                <Clock size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                Time Limit (minutes)
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
                {[5, 10, 15, 30, 45, 60, 90, 120, 180].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    className={`btn btn-sm ${config.timeLimitMinutes === mins ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => updateConfig('timeLimitMinutes', mins)}
                    style={{ minWidth: 48, padding: 'var(--space-1) var(--space-2)', fontSize: 'var(--font-size-xs)' }}
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </button>
                ))}
              </div>
              <input
                type="number"
                className="input"
                value={config.timeLimitMinutes}
                onChange={(e) => updateConfig('timeLimitMinutes', parseInt(e.target.value) || 1)}
                min={1}
                max={300}
                placeholder="Custom duration"
              />
            </div>

            {/* Marks per question */}
            <div className="input-group">
              <label>Marks per Question</label>
              <input
                type="number"
                className="input"
                value={config.marksPerQuestion}
                onChange={(e) => updateConfig('marksPerQuestion', parseFloat(e.target.value) || 1)}
                min={0.25}
                step={0.25}
              />
            </div>

            {/* Negative marking value (conditional) */}
            {config.negativeMarking && (
              <div className="input-group animate-fade-in">
                <label>
                  <MinusCircle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
                  Deduction per Wrong Answer
                </label>
                <input
                  type="number"
                  className="input"
                  value={config.negativeMarkValue}
                  onChange={(e) => updateConfig('negativeMarkValue', parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.25}
                />
              </div>
            )}
          </div>

          {/* Toggle switches */}
          <div style={{
            marginTop: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-4)',
          }}>
            <div className="flex-between">
              <div>
                <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                  <Shuffle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Shuffle Questions
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  Randomize question order each time
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={config.shuffleQuestions}
                  onChange={(e) => updateConfig('shuffleQuestions', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="flex-between">
              <div>
                <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                  <Shuffle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Shuffle Options
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  Randomize option order within each question
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={config.shuffleOptions}
                  onChange={(e) => updateConfig('shuffleOptions', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>

            <div className="flex-between">
              <div>
                <div style={{ fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-sm)' }}>
                  <MinusCircle size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  Negative Marking
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                  Deduct marks for incorrect answers
                </div>
              </div>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={config.negativeMarking}
                  onChange={(e) => updateConfig('negativeMarking', e.target.checked)}
                />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex-row gap-3" style={{ justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleSaveTemplate} disabled={!config.name.trim()}>
            <Save size={16} /> Save as Template
          </button>
          <button
            className="btn btn-primary btn-lg"
            onClick={handleStartTest}
            disabled={config.bankIds.length === 0 || availableQuestions === 0}
          >
            <Play size={18} /> Start Test
          </button>
        </div>
      </div>
    </>
  );
}
