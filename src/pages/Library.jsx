import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import {
  BookOpen,
  FileText,
  Trophy,
  Trash2,
  Download,
  Upload,
  Search,
  Clock,
  Target,
  Edit3,
  Play,
  MoreVertical,
  X,
  AlertCircle,
  CheckCircle2,
  FolderOpen,
} from 'lucide-react';
import Header from '../components/Layout/Header';
import {
  getAllQuestionBanks,
  getAllTestTemplates,
  getAllTestAttempts,
  deleteQuestionBank,
  deleteTestTemplate,
  deleteTestAttempt,
  exportQuestionBank,
  importQuestionBank,
} from '../db/database';

export default function LibraryPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [activeTab, setActiveTab] = useState('banks');
  const [banks, setBanks] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const [b, t, a] = await Promise.all([
        getAllQuestionBanks(),
        getAllTestTemplates(),
        getAllTestAttempts(),
      ]);
      setBanks(b.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)));
      setTemplates(t.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt)));
      setAttempts(a.sort((x, y) => new Date(y.completedAt) - new Date(x.completedAt)));
    } catch (err) {
      setError('Failed to load library data');
    } finally {
      setLoading(false);
    }
  }

  const handleDeleteBank = async (id, name) => {
    if (!confirm(`Delete question bank "${name}"? This cannot be undone.`)) return;
    try {
      await deleteQuestionBank(id);
      setBanks((prev) => prev.filter((b) => b.id !== id));
      setSuccess('Question bank deleted');
    } catch (err) {
      setError('Failed to delete question bank');
    }
  };

  const handleDeleteTemplate = async (id, name) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try {
      await deleteTestTemplate(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setSuccess('Template deleted');
    } catch (err) {
      setError('Failed to delete template');
    }
  };

  const handleDeleteAttempt = async (id) => {
    if (!confirm('Delete this test attempt?')) return;
    try {
      await deleteTestAttempt(id);
      setAttempts((prev) => prev.filter((a) => a.id !== id));
      setSuccess('Attempt deleted');
    } catch (err) {
      setError('Failed to delete attempt');
    }
  };

  const handleExport = async (id, name) => {
    try {
      const json = await exportQuestionBank(id);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${name.replace(/[^a-z0-9]/gi, '_')}_bank.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSuccess('Question bank exported successfully');
    } catch (err) {
      setError(`Export failed: ${err.message}`);
    }
  };

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const bank = await importQuestionBank(text);
      setBanks((prev) => [bank, ...prev]);
      setSuccess(`Imported "${bank.name}" with ${bank.questionCount} questions`);
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }

    e.target.value = '';
  };

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredTemplates = templates.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  );
  const filteredAttempts = attempts.filter((a) =>
    a.templateName.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Auto-clear success messages
  useEffect(() => {
    if (success) {
      const t = setTimeout(() => setSuccess(null), 3000);
      return () => clearTimeout(t);
    }
  }, [success]);

  return (
    <>
      <Header title="Library" subtitle="Manage your question banks, templates & history">
        <button className="btn btn-secondary btn-sm" onClick={() => fileInputRef.current?.click()}>
          <Upload size={14} /> Import
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleImport}
          style={{ display: 'none' }}
        />
      </Header>

      <div className="app-content">
        {/* Notifications */}
        {error && (
          <div className="animate-fade-in" style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-error-bg)', border: '1px solid var(--color-error-muted)',
            borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)',
            color: 'var(--color-error)', fontSize: 'var(--font-size-sm)',
          }}>
            <AlertCircle size={16} /><span>{error}</span>
            <button onClick={() => setError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
              <X size={14} />
            </button>
          </div>
        )}

        {success && (
          <div className="animate-fade-in" style={{
            display: 'flex', alignItems: 'center', gap: 'var(--space-3)',
            padding: 'var(--space-3) var(--space-4)',
            background: 'var(--color-success-bg)', border: '1px solid var(--color-success-muted)',
            borderRadius: 'var(--radius-lg)', marginBottom: 'var(--space-4)',
            color: 'var(--color-success)', fontSize: 'var(--font-size-sm)',
          }}>
            <CheckCircle2 size={16} /><span>{success}</span>
          </div>
        )}

        {/* Tabs + Search */}
        <div className="flex-between" style={{
          marginBottom: 'var(--space-6)',
          flexWrap: 'wrap',
          gap: 'var(--space-4)',
        }}>
          <div className="tabs" style={{ maxWidth: 500 }}>
            <button className={`tab ${activeTab === 'banks' ? 'active' : ''}`} onClick={() => setActiveTab('banks')}>
              <BookOpen size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Banks ({banks.length})
            </button>
            <button className={`tab ${activeTab === 'templates' ? 'active' : ''}`} onClick={() => setActiveTab('templates')}>
              <FileText size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Templates ({templates.length})
            </button>
            <button className={`tab ${activeTab === 'attempts' ? 'active' : ''}`} onClick={() => setActiveTab('attempts')}>
              <Trophy size={14} style={{ marginRight: 4, verticalAlign: -2 }} />
              Attempts ({attempts.length})
            </button>
          </div>

          <div style={{ position: 'relative', width: 260 }}>
            <Search size={16} style={{
              position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--color-text-muted)',
            }} />
            <input
              className="input input-sm"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ paddingLeft: 36 }}
            />
          </div>
        </div>

        {/* Question Banks Tab */}
        {activeTab === 'banks' && (
          <div className="animate-fade-in">
            {filteredBanks.length === 0 ? (
              <div className="empty-state">
                <FolderOpen size={48} />
                <h3>No Question Banks</h3>
                <p>Upload questions or paste text to create your first question bank.</p>
                <button className="btn btn-primary" onClick={() => navigate('/upload')} style={{ marginTop: 'var(--space-4)' }}>
                  <Upload size={16} /> Upload Questions
                </button>
              </div>
            ) : (
              <div className="grid grid-2">
                {filteredBanks.map((bank) => (
                  <div key={bank.id} className="card card-glow animate-fade-in-up">
                    <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                      <div className="flex-row gap-3">
                        <div style={{
                          width: 40, height: 40, borderRadius: 'var(--radius-lg)',
                          background: 'rgba(99, 102, 241, 0.15)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <BookOpen size={20} color="#6366f1" />
                        </div>
                        <div>
                          <h4 style={{ fontSize: 'var(--font-size-base)' }}>{bank.name}</h4>
                          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                            {formatDate(bank.createdAt)}
                          </p>
                        </div>
                      </div>
                    </div>

                    {bank.description && (
                      <p className="line-clamp-2" style={{
                        fontSize: 'var(--font-size-sm)', color: 'var(--color-text-secondary)',
                        marginBottom: 'var(--space-3)',
                      }}>
                        {bank.description}
                      </p>
                    )}

                    <div className="flex-row gap-2 flex-wrap" style={{ marginBottom: 'var(--space-4)' }}>
                      <span className="badge badge-primary">{bank.questionCount} questions</span>
                      {(bank.tags || []).slice(0, 3).map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
                      ))}
                    </div>

                    <div className="flex-row gap-2" style={{ borderTop: '1px solid var(--color-surface-border)', paddingTop: 'var(--space-3)' }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => handleExport(bank.id, bank.name)}>
                        <Download size={14} /> Export
                      </button>
                      <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/test/config?bankId=${bank.id}`)}>
                        <Play size={14} /> Test
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteBank(bank.id, bank.name)}
                        style={{ marginLeft: 'auto', color: 'var(--color-error)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <div className="animate-fade-in">
            {filteredTemplates.length === 0 ? (
              <div className="empty-state">
                <FileText size={48} />
                <h3>No Test Templates</h3>
                <p>Configure and save a test to create a reusable template.</p>
                <button className="btn btn-primary" onClick={() => navigate('/test/config')} style={{ marginTop: 'var(--space-4)' }}>
                  New Test
                </button>
              </div>
            ) : (
              <div className="grid grid-2">
                {filteredTemplates.map((tmpl) => (
                  <div key={tmpl.id} className="card card-glow animate-fade-in-up">
                    <div className="flex-between" style={{ marginBottom: 'var(--space-3)' }}>
                      <h4>{tmpl.name}</h4>
                    </div>
                    <div className="flex-row gap-2 flex-wrap" style={{ marginBottom: 'var(--space-4)' }}>
                      <span className="badge badge-primary">{tmpl.questionCount} questions</span>
                      <span className="badge badge-neutral">{tmpl.timeLimitMinutes} min</span>
                      {tmpl.shuffleQuestions && <span className="badge badge-neutral">Shuffled</span>}
                      {tmpl.negativeMarking && (
                        <span className="badge badge-warning">-{tmpl.negativeMarkValue} negative</span>
                      )}
                    </div>
                    <div className="flex-row gap-2" style={{ borderTop: '1px solid var(--color-surface-border)', paddingTop: 'var(--space-3)' }}>
                      <button className="btn btn-primary btn-sm" onClick={() => navigate(`/test/config?templateId=${tmpl.id}`)}>
                        <Play size={14} /> Start Test
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleDeleteTemplate(tmpl.id, tmpl.name)}
                        style={{ marginLeft: 'auto', color: 'var(--color-error)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Attempts Tab */}
        {activeTab === 'attempts' && (
          <div className="animate-fade-in">
            {filteredAttempts.length === 0 ? (
              <div className="empty-state">
                <Trophy size={48} />
                <h3>No Test Attempts</h3>
                <p>Take a test to see your results here.</p>
              </div>
            ) : (
              <div className="flex-col gap-3">
                {filteredAttempts.map((attempt) => (
                  <div
                    key={attempt.id}
                    className="card card-interactive"
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: 'var(--space-4) var(--space-6)',
                    }}
                  >
                    <div
                      className="flex-row gap-4 pointer"
                      style={{ flex: 1 }}
                      onClick={() => navigate(`/test/results/${attempt.id}`)}
                    >
                      <div style={{
                        width: 48, height: 48, borderRadius: 'var(--radius-lg)',
                        background: attempt.accuracy >= 70
                          ? 'var(--color-success-muted)' : attempt.accuracy >= 40
                            ? 'var(--color-warning-muted)' : 'var(--color-error-muted)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 'var(--font-size-lg)', fontWeight: 'var(--font-weight-bold)',
                        color: attempt.accuracy >= 70 ? 'var(--color-success)' : attempt.accuracy >= 40 ? 'var(--color-warning)' : 'var(--color-error)',
                      }}>
                        {Math.round(attempt.accuracy)}%
                      </div>
                      <div>
                        <div style={{ fontWeight: 'var(--font-weight-semibold)' }}>{attempt.templateName}</div>
                        <div className="flex-row gap-3" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                          <span><Clock size={12} style={{ verticalAlign: -2 }} /> {formatDate(attempt.completedAt)}</span>
                          <span><Target size={12} style={{ verticalAlign: -2 }} /> {attempt.score}/{attempt.maxScore}</span>
                          <span>{attempt.correctCount}/{attempt.totalQuestions} correct</span>
                        </div>
                      </div>
                    </div>
                    <button
                      className="btn btn-ghost btn-icon btn-sm"
                      onClick={() => handleDeleteAttempt(attempt.id)}
                      style={{ color: 'var(--color-error)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
