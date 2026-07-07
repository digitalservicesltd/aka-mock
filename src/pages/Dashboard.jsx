import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Upload,
  Library,
  GraduationCap,
  TrendingUp,
  BookOpen,
  Clock,
  Target,
  ArrowRight,
  Zap,
  FileText,
  Trophy,
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { getAllQuestionBanks, getAllTestAttempts, getAllTestTemplates } from '../db/database';

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalBanks: 0,
    totalQuestions: 0,
    totalAttempts: 0,
    totalTemplates: 0,
    avgScore: 0,
  });
  const [recentAttempts, setRecentAttempts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  async function loadStats() {
    try {
      const [banks, attempts, templates] = await Promise.all([
        getAllQuestionBanks(),
        getAllTestAttempts(),
        getAllTestTemplates(),
      ]);

      const totalQuestions = banks.reduce((sum, b) => sum + (b.questionCount || 0), 0);
      const avgScore = attempts.length > 0
        ? Math.round(attempts.reduce((sum, a) => sum + (a.accuracy || 0), 0) / attempts.length)
        : 0;

      setStats({
        totalBanks: banks.length,
        totalQuestions,
        totalAttempts: attempts.length,
        totalTemplates: templates.length,
        avgScore,
      });

      // Get last 5 attempts sorted by date
      const sorted = [...attempts].sort((a, b) =>
        new Date(b.completedAt) - new Date(a.completedAt)
      );
      setRecentAttempts(sorted.slice(0, 5));
    } catch (err) {
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  }

  const quickActions = [
    {
      icon: Upload,
      title: 'Upload Questions',
      description: 'Scan images or PDFs with OCR to extract MCQs',
      color: '#6366f1',
      path: '/upload',
    },
    {
      icon: GraduationCap,
      title: 'Start Test',
      description: 'Configure and take a new mock test',
      color: '#06b6d4',
      path: '/test/config',
    },
    {
      icon: Library,
      title: 'Library',
      description: 'Manage question banks, templates & history',
      color: '#10b981',
      path: '/library',
    },
  ];

  const statCards = [
    { icon: BookOpen, label: 'Question Banks', value: stats.totalBanks, color: '#6366f1' },
    { icon: FileText, label: 'Total Questions', value: stats.totalQuestions, color: '#06b6d4' },
    { icon: Trophy, label: 'Tests Taken', value: stats.totalAttempts, color: '#f59e0b' },
    { icon: Target, label: 'Avg. Score', value: `${stats.avgScore}%`, color: '#10b981' },
  ];

  return (
    <>
      <Header title="Dashboard" subtitle="Welcome to MockMaster" />

      <div className="app-content">
        {/* Hero Section */}
        <div className="hero-gradient animate-fade-in" style={{
          borderRadius: 'var(--radius-2xl)',
          padding: 'var(--space-12) var(--space-8)',
          marginBottom: 'var(--space-8)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          <div className="gradient-orb gradient-orb-1" />
          <div className="gradient-orb gradient-orb-2" />
          <div style={{ position: 'relative', zIndex: 1, maxWidth: 600 }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-1) var(--space-3)',
              background: 'var(--color-accent-muted)',
              borderRadius: 'var(--radius-full)',
              marginBottom: 'var(--space-4)',
              fontSize: 'var(--font-size-xs)',
              fontWeight: 'var(--font-weight-semibold)',
              color: 'var(--color-accent-hover)',
            }}>
              <Zap size={14} />
              100% Offline · Private · No API Keys
            </div>
            <h1 style={{
              fontSize: 'var(--font-size-4xl)',
              fontWeight: 'var(--font-weight-extrabold)',
              marginBottom: 'var(--space-3)',
              lineHeight: 'var(--line-height-tight)',
            }}>
              Your Personal <span className="text-gradient">Mock Test</span> Generator
            </h1>
            <p style={{
              color: 'var(--color-text-secondary)',
              fontSize: 'var(--font-size-base)',
              lineHeight: 'var(--line-height-relaxed)',
              marginBottom: 'var(--space-6)',
            }}>
              Upload question papers, extract text with OCR, build custom tests, and track your progress — all running entirely in your browser.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => navigate('/upload')}>
              Get Started <ArrowRight size={18} />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-4" style={{ marginBottom: 'var(--space-8)' }}>
          {statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <div
                key={stat.label}
                className={`card card-glow animate-fade-in-up stagger-${i + 1}`}
                style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-lg)',
                  background: `${stat.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <Icon size={22} color={stat.color} />
                </div>
                <div>
                  <div style={{
                    fontSize: 'var(--font-size-2xl)',
                    fontWeight: 'var(--font-weight-bold)',
                    lineHeight: 1,
                    marginBottom: 'var(--space-1)',
                  }}>
                    {loading ? '—' : stat.value}
                  </div>
                  <div style={{
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--color-text-tertiary)',
                  }}>
                    {stat.label}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Quick Actions</h3>
        <div className="grid grid-3" style={{ marginBottom: 'var(--space-8)' }}>
          {quickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <div
                key={action.title}
                className={`card card-interactive card-glow animate-fade-in-up stagger-${i + 1}`}
                onClick={() => navigate(action.path)}
                style={{ cursor: 'pointer' }}
              >
                <div style={{
                  width: 48,
                  height: 48,
                  borderRadius: 'var(--radius-lg)',
                  background: `${action.color}15`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 'var(--space-4)',
                }}>
                  <Icon size={24} color={action.color} />
                </div>
                <h4 style={{ marginBottom: 'var(--space-2)' }}>{action.title}</h4>
                <p style={{
                  color: 'var(--color-text-secondary)',
                  fontSize: 'var(--font-size-sm)',
                  lineHeight: 'var(--line-height-relaxed)',
                }}>
                  {action.description}
                </p>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-2)',
                  marginTop: 'var(--space-4)',
                  color: action.color,
                  fontSize: 'var(--font-size-sm)',
                  fontWeight: 'var(--font-weight-semibold)',
                }}>
                  Get started <ArrowRight size={16} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent Attempts */}
        <h3 style={{ marginBottom: 'var(--space-4)' }}>Recent Attempts</h3>
        {recentAttempts.length === 0 ? (
          <div className="card" style={{ textAlign: 'center', padding: 'var(--space-10)' }}>
            <Clock size={40} style={{ margin: '0 auto var(--space-4)', opacity: 0.3 }} />
            <p style={{ color: 'var(--color-text-tertiary)' }}>
              No test attempts yet. Upload questions and take your first test!
            </p>
          </div>
        ) : (
          <div className="flex-col gap-3">
            {recentAttempts.map((attempt) => (
              <div
                key={attempt.id}
                className="card card-interactive"
                onClick={() => navigate(`/test/results/${attempt.id}`)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: 'var(--space-4) var(--space-6)',
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: attempt.accuracy >= 70
                      ? 'var(--color-success-muted)'
                      : attempt.accuracy >= 40
                        ? 'var(--color-warning-muted)'
                        : 'var(--color-error-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <TrendingUp size={18} color={
                      attempt.accuracy >= 70 ? '#10b981' :
                      attempt.accuracy >= 40 ? '#f59e0b' : '#ef4444'
                    } />
                  </div>
                  <div>
                    <div style={{ fontWeight: 'var(--font-weight-semibold)', fontSize: 'var(--font-size-sm)' }}>
                      {attempt.templateName}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      {new Date(attempt.completedAt).toLocaleDateString()} · {attempt.totalQuestions} questions
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{
                    fontSize: 'var(--font-size-lg)',
                    fontWeight: 'var(--font-weight-bold)',
                    color: attempt.accuracy >= 70 ? 'var(--color-success)' :
                           attempt.accuracy >= 40 ? 'var(--color-warning)' : 'var(--color-error)',
                  }}>
                    {Math.round(attempt.accuracy)}%
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    {attempt.score}/{attempt.maxScore}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
