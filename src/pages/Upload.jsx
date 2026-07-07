import { useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import {
  Upload as UploadIcon,
  FileText,
  Image,
  X,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ClipboardPaste,
  Wand2,
  Sparkles,
  Eye,
  Info,
} from 'lucide-react';
import Header from '../components/Layout/Header';
import { parsePDF, readFileAsArrayBuffer } from '../services/pdfService';
import { runOCR, combineOCRText } from '../services/ocrService';
import { parseQuestions } from '../services/parserService';

export default function UploadPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Tab state
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'paste'

  // File upload state
  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [processingStage, setProcessingStage] = useState(''); // 'pdf' | 'ocr' | 'parsing'
  const [pdfProgress, setPdfProgress] = useState({ current: 0, total: 0 });
  const [ocrProgress, setOcrProgress] = useState({ current: 0, total: 0, percent: 0 });

  // Text state
  const [extractedText, setExtractedText] = useState('');
  const [pasteText, setPasteText] = useState('');

  // Live preview state
  const [showPreview, setShowPreview] = useState(false);

  // Error state
  const [error, setError] = useState(null);

  // Accept file types
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

  const handleFileSelect = useCallback((selectedFiles) => {
    const validFiles = Array.from(selectedFiles).filter((f) =>
      acceptedTypes.some((t) => f.type === t || f.name.toLowerCase().endsWith('.pdf'))
    );

    if (validFiles.length === 0) {
      setError('No valid files selected. Please upload JPG, PNG, or PDF files.');
      return;
    }

    setFiles((prev) => [...prev, ...validFiles]);
    setError(null);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileSelect(e.dataTransfer.files);
  }, [handleFileSelect]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Process files: PDF → images → OCR → text
  const processFiles = async () => {
    if (files.length === 0) {
      setError('Please add at least one file');
      return;
    }

    setProcessing(true);
    setError(null);
    setExtractedText('');

    try {
      const allImages = [];

      // Step 1: Convert PDFs to images
      const pdfFiles = files.filter((f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
      const imageFiles = files.filter((f) => f.type?.startsWith('image/'));

      if (pdfFiles.length > 0) {
        setProcessingStage('pdf');
        for (const pdfFile of pdfFiles) {
          const arrayBuffer = await readFileAsArrayBuffer(pdfFile);
          const pageBlobs = await parsePDF(arrayBuffer, (progress) => {
            setPdfProgress({
              current: progress.currentPage,
              total: progress.totalPages,
              fileName: pdfFile.name,
            });
          });
          allImages.push(...pageBlobs);
        }
      }

      // Add image files directly
      for (const imgFile of imageFiles) {
        allImages.push(imgFile);
      }

      if (allImages.length === 0) {
        setError('No images to process. PDFs may be empty or corrupted.');
        setProcessing(false);
        return;
      }

      // Step 2: Run OCR
      setProcessingStage('ocr');
      const ocrResults = await runOCR(allImages, (progress) => {
        setOcrProgress({
          current: progress.currentImage,
          total: progress.totalImages,
          percent: progress.ocrProgress || 0,
          status: progress.status,
        });
      });

      const combinedText = combineOCRText(ocrResults);

      if (!combinedText.trim()) {
        setError('OCR could not extract any text. The images may be too blurry or not contain text. Try pasting text manually.');
        setProcessing(false);
        return;
      }

      setExtractedText(combinedText);
      setProcessingStage('done');
    } catch (err) {
      console.error('Processing error:', err);
      setError(`Processing failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  // Parse the text and navigate to review
  const handleParse = () => {
    const textToParse = activeTab === 'upload' ? extractedText : pasteText;

    if (!textToParse.trim()) {
      setError('No text to parse. Please extract text from files or paste it manually.');
      return;
    }

    const result = parseQuestions(textToParse);

    // Store in sessionStorage for the review page
    sessionStorage.setItem('parsedQuestions', JSON.stringify(result.questions));
    sessionStorage.setItem('parseWarnings', JSON.stringify(result.warnings));
    sessionStorage.setItem('rawText', textToParse);

    navigate('/review');
  };

  // Live preview of parsing
  const livePreview = useMemo(() => {
    const text = activeTab === 'upload' ? extractedText : pasteText;
    if (!text || text.trim().length < 10) return null;
    try {
      const result = parseQuestions(text);
      const withOptions = result.questions.filter(q => q.options.length >= 2);
      const withAnswers = result.questions.filter(q => q.correctAnswer);
      const lowConf = result.questions.filter(q => q.confidence === 'low');
      return {
        total: result.questions.length,
        withOptions: withOptions.length,
        withAnswers: withAnswers.length,
        lowConf: lowConf.length,
        firstQuestion: result.questions[0]?.questionText?.slice(0, 80) || '',
        warnings: result.warnings,
      };
    } catch {
      return null;
    }
  }, [activeTab, extractedText, pasteText]);

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getProcessingMessage = () => {
    if (processingStage === 'pdf') {
      return `Converting PDF page ${pdfProgress.current}/${pdfProgress.total}${pdfProgress.fileName ? ` — ${pdfProgress.fileName}` : ''}`;
    }
    if (processingStage === 'ocr') {
      return `Running OCR on image ${ocrProgress.current}/${ocrProgress.total} (${ocrProgress.percent}%)`;
    }
    return 'Processing...';
  };

  const getProgressPercent = () => {
    if (processingStage === 'pdf' && pdfProgress.total > 0) {
      return Math.round((pdfProgress.current / pdfProgress.total) * 50); // PDF is first 50%
    }
    if (processingStage === 'ocr' && ocrProgress.total > 0) {
      const ocrBase = 50;
      const ocrPortion = ((ocrProgress.current - 1) / ocrProgress.total) * 50;
      const currentPercent = (ocrProgress.percent / 100) * (50 / ocrProgress.total);
      return Math.round(ocrBase + ocrPortion + currentPercent);
    }
    return 0;
  };

  return (
    <>
      <Header title="Upload & OCR" subtitle="Extract questions from images and PDFs" />

      <div className="app-content">
        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 'var(--space-6)', maxWidth: 400 }}>
          <button
            className={`tab ${activeTab === 'upload' ? 'active' : ''}`}
            onClick={() => setActiveTab('upload')}
          >
            <UploadIcon size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            File Upload
          </button>
          <button
            className={`tab ${activeTab === 'paste' ? 'active' : ''}`}
            onClick={() => setActiveTab('paste')}
          >
            <ClipboardPaste size={16} style={{ marginRight: 6, verticalAlign: -3 }} />
            Paste Text
          </button>
        </div>

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
            <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>{error}</div>
            <button
              onClick={() => setError(null)}
              style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            >
              <X size={16} />
            </button>
          </div>
        )}

        {activeTab === 'upload' && (
          <div className="animate-fade-in">
            {/* Dropzone */}
            <div
              className={`dropzone ${dragOver ? 'dragover' : ''}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
              style={{ marginBottom: 'var(--space-6)' }}
            >
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".jpg,.jpeg,.png,.webp,.pdf"
                onChange={(e) => handleFileSelect(e.target.files)}
                style={{ display: 'none' }}
              />
              <UploadIcon size={48} />
              <h4 style={{ marginBottom: 'var(--space-2)' }}>
                Drop files here or click to browse
              </h4>
              <p style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-sm)' }}>
                Supports JPG, PNG, WebP images and PDF files
              </p>
            </div>

            {/* File list */}
            {files.length > 0 && (
              <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                  <h4>{files.length} file{files.length !== 1 ? 's' : ''} selected</h4>
                  <button className="btn btn-ghost btn-sm" onClick={() => setFiles([])}>
                    Clear all
                  </button>
                </div>

                <div className="flex-col gap-2">
                  {files.map((file, index) => (
                    <div key={index} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-3)',
                      padding: 'var(--space-3)',
                      background: 'var(--color-bg-tertiary)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--font-size-sm)',
                    }}>
                      {file.type?.startsWith('image') ? (
                        <Image size={18} color="var(--color-secondary)" />
                      ) : (
                        <FileText size={18} color="var(--color-error)" />
                      )}
                      <span className="truncate" style={{ flex: 1 }}>{file.name}</span>
                      <span style={{ color: 'var(--color-text-tertiary)', fontSize: 'var(--font-size-xs)' }}>
                        {formatFileSize(file.size)}
                      </span>
                      <button
                        className="btn btn-ghost btn-icon btn-sm"
                        onClick={() => removeFile(index)}
                        style={{ width: 28, height: 28 }}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Process button */}
                <button
                  className="btn btn-primary btn-lg w-full"
                  onClick={processFiles}
                  disabled={processing}
                  style={{ marginTop: 'var(--space-4)' }}
                >
                  {processing ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      {getProcessingMessage()}
                    </>
                  ) : (
                    <>
                      <Wand2 size={18} />
                      Extract Text with OCR
                    </>
                  )}
                </button>

                {/* Progress bar */}
                {processing && (
                  <div style={{ marginTop: 'var(--space-3)' }}>
                    <div className="progress-bar">
                      <div
                        className="progress-bar-fill"
                        style={{ width: `${getProgressPercent()}%` }}
                      />
                    </div>
                    <p style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-text-tertiary)',
                      marginTop: 'var(--space-2)',
                      textAlign: 'center',
                    }}>
                      {getProcessingMessage()}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Extracted text preview */}
            {extractedText && (
              <div className="card animate-fade-in" style={{ marginBottom: 'var(--space-6)' }}>
                <div className="flex-between" style={{ marginBottom: 'var(--space-4)' }}>
                  <div className="flex-row gap-2">
                    <CheckCircle2 size={20} color="var(--color-success)" />
                    <h4>Extracted Text</h4>
                  </div>
                  <span className="badge badge-success">Ready to parse</span>
                </div>
                <textarea
                  className="input"
                  value={extractedText}
                  onChange={(e) => setExtractedText(e.target.value)}
                  style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 'var(--font-size-xs)' }}
                  placeholder="Extracted text will appear here..."
                />
                <p style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  marginTop: 'var(--space-2)',
                }}>
                  You can edit the extracted text before parsing. Fix any OCR errors you notice.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'paste' && (
          <div className="animate-fade-in">
            <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
              <h4 style={{ marginBottom: 'var(--space-3)' }}>Paste Question Text</h4>
              <p style={{
                color: 'var(--color-text-tertiary)',
                fontSize: 'var(--font-size-sm)',
                marginBottom: 'var(--space-4)',
              }}>
                Paste the question text directly. This bypasses OCR entirely.
              </p>
              <textarea
                className="input"
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                style={{ minHeight: 300, fontFamily: 'monospace', fontSize: 'var(--font-size-sm)' }}
                placeholder={`Paste your questions here. Example format:\n\n1. What is the capital of France?\nA) London\nB) Paris\nC) Berlin\nD) Madrid\nAnswer: B\n\n2. Which planet is closest to the Sun?\nA) Venus\nB) Earth\nC) Mercury\nD) Mars\nAnswer: C`}
              />
            </div>
          </div>
        )}

        {/* Universal Parser Info + Live Preview */}
        <div className="card" style={{ marginBottom: 'var(--space-6)' }}>
          <div className="flex-row gap-3" style={{ marginBottom: 'var(--space-4)' }}>
            <Sparkles size={20} color="var(--color-accent)" />
            <div>
              <h4>Universal Auto-Detect Parser</h4>
              <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                Automatically detects question numbers, options (A./a)/(A)/①), and answer keys
              </p>
            </div>
          </div>

          {/* Supported formats */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'var(--space-2)',
            marginBottom: 'var(--space-4)',
          }}>
            {['SSC', 'UPSC', 'Banking', 'Railway', 'DSSSB', 'State PSC', 'School', 'Coaching'].map(tag => (
              <span key={tag} className="badge" style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                fontSize: 'var(--font-size-xs)',
              }}>
                {tag}
              </span>
            ))}
          </div>

          {/* Live Preview */}
          {livePreview && (
            <div className="animate-fade-in" style={{
              padding: 'var(--space-4)',
              background: 'var(--color-bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: livePreview.lowConf > 0
                ? '1px solid var(--color-warning-muted)'
                : '1px solid var(--color-success-muted)',
            }}>
              <div className="flex-row gap-2" style={{ marginBottom: 'var(--space-3)' }}>
                <Eye size={16} color="var(--color-accent)" />
                <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>Live Preview</span>
              </div>

              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: 'var(--space-3)',
                marginBottom: 'var(--space-3)',
              }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-primary)' }}>
                    {livePreview.total}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    Questions
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-success)' }}>
                    {livePreview.withOptions}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    With Options
                  </div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-secondary)' }}>
                    {livePreview.withAnswers}
                  </div>
                  <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                    With Answers
                  </div>
                </div>
                {livePreview.lowConf > 0 && (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--color-warning)' }}>
                      {livePreview.lowConf}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-tertiary)' }}>
                      Need Review
                    </div>
                  </div>
                )}
              </div>

              {livePreview.firstQuestion && (
                <p style={{
                  fontSize: 'var(--font-size-xs)',
                  color: 'var(--color-text-tertiary)',
                  fontStyle: 'italic',
                }}>
                  First: "{livePreview.firstQuestion}{livePreview.firstQuestion.length >= 80 ? '…' : ''}"
                </p>
              )}

              {livePreview.warnings.length > 0 && (
                <div style={{ marginTop: 'var(--space-3)', display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {livePreview.warnings.slice(0, 3).map((w, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--space-2)',
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--color-warning)',
                    }}>
                      <Info size={12} />
                      {w}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Parse & Continue Button */}
        <button
          className="btn btn-primary btn-lg"
          onClick={handleParse}
          disabled={!(activeTab === 'upload' ? extractedText : pasteText).trim()}
          style={{ minWidth: 250 }}
        >
          <Wand2 size={18} />
          Parse Questions & Review
        </button>
      </div>
    </>
  );
}
