import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CodeReview from '../pages/CodeReview';
import FindingsPanel from '../components/editor/FindingsPanel';
import apiClient from '../services/apiClient';

// Mock Monaco Editor for JSDOM
const mockRevealLineInCenter = vi.fn();
const mockSetPosition = vi.fn();
const mockFocus = vi.fn();
const mockDeltaDecorations = vi.fn().mockReturnValue(['dec-1']);

vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, onChange, onMount }) => {
    React.useEffect(() => {
      if (onMount) {
        onMount(
          {
            revealLineInCenter: mockRevealLineInCenter,
            setPosition: mockSetPosition,
            focus: mockFocus,
            deltaDecorations: mockDeltaDecorations,
            getModel: () => ({ getLineCount: () => 100 })
          },
          {
            Range: function (a, b, c, d) {
              return { a, b, c, d };
            },
            editor: {
              OverviewRulerLane: { Right: 4 },
              setTheme: vi.fn()
            }
          }
        );
      }
    }, [onMount]);

    return (
      <div data-testid="monaco-editor-container" data-language={language}>
        <textarea
          data-testid="monaco-editor-textarea"
          value={value}
          onChange={(e) => onChange && onChange(e.target.value)}
        />
      </div>
    );
  },
  loader: {
    config: vi.fn(),
    init: vi.fn().mockResolvedValue({})
  }
}));

vi.mock('../config/monacoWorkers', () => ({
  configureMonaco: vi.fn(),
  monaco: {
    editor: {
      defineTheme: vi.fn(),
      setTheme: vi.fn()
    }
  },
  default: vi.fn()
}));

// Mock apiClient
vi.mock('../services/apiClient', () => ({
  default: {
    analyzeCode: vi.fn()
  },
  apiClient: {
    analyzeCode: vi.fn()
  }
}));

const mockAnalysisData = {
  transient: true,
  language: 'python',
  fileName: 'script.py',
  metrics: {
    totalLines: 15,
    analyzedLines: 12,
    totalFindings: 2,
    securityFindings: 1,
    riskFindings: 1,
    qualityFindings: 0,
    severityCounts: {
      critical: 1,
      high: 1,
      medium: 0,
      low: 0,
      info: 0
    },
    characterCount: 350,
    executionTimeMs: 8
  },
  scoring: {
    overallScore: 63,
    grade: 'C',
    categoryScores: {
      security: 75,
      risk: 85,
      quality: 100
    },
    disclaimer: 'Deterministic pattern analysis.'
  },
  findings: [
    {
      id: 'finding_1_sec_gen_001',
      ruleId: 'SEC-GEN-001',
      title: 'Hardcoded AWS Access Key ID',
      category: 'SEC',
      severity: 'CRITICAL',
      lineStart: 3,
      lineEnd: 3,
      columnStart: 10,
      columnEnd: 30,
      originalSnippet: 'aws_key = "AKIAIOSFODNN7EXAMPLE"',
      suggestedSnippet: 'aws_key = os.environ.get("AWS_ACCESS_KEY_ID")',
      explanation: 'Hardcoded AWS Access Key IDs expose cloud infrastructure.'
    },
    {
      id: 'finding_2_risk_py_001',
      ruleId: 'RISK-PY-001',
      title: 'Dangerous Dynamic Execution (eval/exec)',
      category: 'RISK',
      severity: 'HIGH',
      lineStart: 8,
      lineEnd: 8,
      columnStart: 5,
      columnEnd: 20,
      originalSnippet: 'eval(user_data)',
      suggestedSnippet: 'ast.literal_eval(user_data)',
      explanation: 'Dynamic evaluation of expressions allows arbitrary code execution.'
    }
  ]
};

describe('Phase 7: Static Code Analysis Frontend Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  it('Test 1: Analyze Code button triggers apiClient.analyzeCode with editor code and language', async () => {
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: mockAnalysisData
    });

    render(<CodeReview />);

    const analyzeBtn = screen.getByRole('button', { name: /analyze code/i });
    expect(analyzeBtn).toBeInTheDocument();
    expect(analyzeBtn).not.toBeDisabled();

    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(apiClient.analyzeCode).toHaveBeenCalledTimes(1);
      expect(apiClient.analyzeCode).toHaveBeenCalledWith(
        expect.objectContaining({
          language: 'python'
        })
      );
    });
  });

  it('Test 2: Renders FindingsPanel with score, grade, dynamic severity counts, and finding cards', async () => {
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: mockAnalysisData
    });

    render(<CodeReview />);

    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('findings-panel')).toBeInTheDocument();
    });

    // Verify Grade C and score 63
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('63')).toBeInTheDocument();

    // Verify rule IDs
    expect(screen.getByText('SEC-GEN-001')).toBeInTheDocument();
    expect(screen.getByText('RISK-PY-001')).toBeInTheDocument();

    // Verify dynamic filter tabs
    expect(screen.getByRole('button', { name: /all \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /critical \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /high \(1\)/i })).toBeInTheDocument();
  });

  it('Test 3: Severity tab filters findings and shows contextual empty state when none match', async () => {
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: mockAnalysisData
    });

    render(<CodeReview />);
    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('findings-panel')).toBeInTheDocument();
    });

    // Click Critical filter: only SEC-GEN-001 visible
    fireEvent.click(screen.getByRole('button', { name: /critical \(1\)/i }));
    expect(screen.getByText('SEC-GEN-001')).toBeInTheDocument();
    expect(screen.queryByText('RISK-PY-001')).not.toBeInTheDocument();

    // Click All filter: both visible
    fireEvent.click(screen.getByRole('button', { name: /all \(2\)/i }));
    expect(screen.getByText('SEC-GEN-001')).toBeInTheDocument();
    expect(screen.getByText('RISK-PY-001')).toBeInTheDocument();
  });

  it('Test 4: Clean code zero-state renders Grade A card when 0 findings returned', async () => {
    const cleanData = {
      ...mockAnalysisData,
      scoring: { overallScore: 100, grade: 'A', categoryScores: { security: 100, risk: 100, quality: 100 } },
      metrics: { ...mockAnalysisData.metrics, totalFindings: 0, severityCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 } },
      findings: []
    };

    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: cleanData
    });

    render(<CodeReview />);
    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByText('No Issues Detected')).toBeInTheDocument();
      expect(screen.getByText('A')).toBeInTheDocument();
      expect(screen.getByText('100')).toBeInTheDocument();
    });
  });

  it('Test 5: Clicking finding card triggers Monaco line navigation to finding lineStart', async () => {
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: mockAnalysisData
    });

    render(<CodeReview />);
    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('finding-card-finding_1_sec_gen_001')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('finding-card-finding_1_sec_gen_001'));

    expect(mockRevealLineInCenter).toHaveBeenCalledWith(3);
    expect(mockSetPosition).toHaveBeenCalledWith({ lineNumber: 3, column: 10 });
    expect(mockFocus).toHaveBeenCalled();
  });

  it('Test 6: Copy Fix copies suggested snippet to clipboard without modifying editor content', async () => {
    render(
      <FindingsPanel
        analysisResult={mockAnalysisData}
        onSelectFinding={vi.fn()}
      />
    );

    const copyButtons = screen.getAllByRole('button', { name: /copy suggested fix/i });
    expect(copyButtons.length).toBe(2);

    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'aws_key = os.environ.get("AWS_ACCESS_KEY_ID")'
    );

    await waitFor(() => {
      expect(screen.getByText('Copied!')).toBeInTheDocument();
    });
  });

  it('Test 7: Editing code buffer marks analysis results stale and clears decorations', async () => {
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: mockAnalysisData
    });

    render(<CodeReview />);
    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByTestId('findings-panel')).toBeInTheDocument();
    });

    // Edit code in textarea
    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, { target: { value: 'edited code content' } });

    await waitFor(() => {
      expect(screen.getByText(/source modified since analysis/i)).toBeInTheDocument();
      expect(screen.getByText('Re-run')).toBeInTheDocument();
    });
  });

  it('Test 8: API failure displays dismissible error banner', async () => {
    apiClient.analyzeCode.mockRejectedValueOnce(
      new Error('Static analysis engine timeout')
    );

    render(<CodeReview />);
    fireEvent.click(screen.getByRole('button', { name: /analyze code/i }));

    await waitFor(() => {
      expect(screen.getByText('Static analysis engine timeout')).toBeInTheDocument();
    });

    // Dismiss error
    fireEvent.click(screen.getByRole('button', { name: /dismiss error/i }));
    expect(screen.queryByText('Static analysis engine timeout')).not.toBeInTheDocument();
  });

  it('Test 9: Findings card displays CWE badge, OWASP category badge, confidence status, and remediation explanation', () => {
    const analysisWithSecData = {
      scoring: { overallScore: 75, grade: 'B' },
      metrics: {
        totalLines: 10,
        executionTimeMs: 5,
        severityCounts: { critical: 1, high: 0, medium: 0, low: 0, info: 0 }
      },
      findings: [
        {
          id: 'finding-1',
          ruleId: 'SEC-PY-SQL-002',
          category: 'SEC',
          severity: 'CRITICAL',
          title: 'SQL Injection via Dynamic String Concatenation',
          explanation: 'Untrusted user input alters SQL logic.',
          cwe: 'CWE-89',
          owaspCategory: 'A03:2021-Injection',
          confidence: 'HIGH',
          lineStart: 7,
          columnStart: 5,
          originalSnippet: 'query = "SELECT * FROM users WHERE username = \'" + username',
          suggestedSnippet: 'cursor.execute("SELECT * FROM users WHERE username = ?", (username,))',
          remediation: 'Use parameterized query placeholders to prevent SQL injection.'
        }
      ]
    };

    render(
      <FindingsPanel
        analysisResult={analysisWithSecData}
        onSelectFinding={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByTestId('badge-cwe')).toHaveTextContent('CWE-89');
    expect(screen.getByTestId('badge-owasp')).toHaveTextContent('A03:2021-Injection');
    expect(screen.getByTestId('badge-confidence')).toHaveTextContent('HIGH Confidence');
    expect(screen.getByText(/Why this correction works:/i)).toBeInTheDocument();
    expect(screen.getByText(/Use parameterized query placeholders to prevent SQL injection/i)).toBeInTheDocument();
    expect(screen.getByText(/Corrected Code Suggestion/i)).toBeInTheDocument();
  });

  it('Test 10: Dynamic language mismatch displays warning banner and button to switch language', async () => {
    render(<CodeReview />);

    // Switch to C++ initially
    fireEvent.click(screen.getByRole('button', { name: /select programming language/i }));
    fireEvent.click(screen.getByRole('option', { name: /C\+\+/i }));

    // Paste Python code into editor textarea
    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, {
      target: {
        value: 'import sqlite3\nconn = sqlite3.connect("test.db")\ndef login(username, password):\n    pass\n'
      }
    });

    await waitFor(() => {
      expect(screen.getByTestId('language-mismatch-banner')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /switch to python/i })).toBeInTheDocument();
    });

    // Clicking switch to Python changes language without clearing code
    fireEvent.click(screen.getByRole('button', { name: /switch to python/i }));

    await waitFor(() => {
      expect(screen.queryByTestId('language-mismatch-banner')).not.toBeInTheDocument();
    });
  });
});

