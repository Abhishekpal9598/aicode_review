import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import CodeReview from '../pages/CodeReview';
import { ApplyFixModal } from '../components/editor/ApplyFixModal';
import FindingsPanel from '../components/editor/FindingsPanel';
import EditorToolbar from '../components/editor/EditorToolbar';
import apiClient from '../services/apiClient';

// Mock monaco-editor and @monaco-editor/react for JSDOM
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, theme, onChange, onMount, options }) => {
    // Call onMount with mock editor on first render
    React.useEffect(() => {
      if (onMount) {
        const mockModel = {
          getLineCount: () => (value ? value.split(/\r?\n/).length : 1),
          getLineMaxColumn: (line) => {
            const lines = value ? value.split(/\r?\n/) : [];
            return (lines[line - 1]?.length || 0) + 1;
          }
        };
        const mockEditor = {
          getModel: () => mockModel,
          revealLineInCenter: vi.fn(),
          setPosition: vi.fn(),
          focus: vi.fn(),
          executeEdits: vi.fn((source, edits) => {
            if (onChange && edits && edits[0]) {
              // Apply edit simulation
            }
          }),
          pushUndoStop: vi.fn(),
          setValue: vi.fn((val) => onChange && onChange(val)),
          deltaDecorations: vi.fn(() => [])
        };
        const mockMonaco = {
          Range: class {
            constructor(sl, sc, el, ec) {
              this.startLineNumber = sl;
              this.startColumn = sc;
              this.endLineNumber = el;
              this.endColumn = ec;
            }
          },
          editor: {
            OverviewRulerLane: { Full: 1 },
            setTheme: vi.fn(),
            defineTheme: vi.fn()
          }
        };
        onMount(mockEditor, mockMonaco);
      }
    }, []);

    return (
      <div
        data-testid="monaco-editor-container"
        data-language={language}
        data-theme={theme}
      >
        <textarea
          data-testid="monaco-editor-textarea"
          aria-label="Code Editor"
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

// Mock monacoWorkers to prevent worker execution in JSDOM
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

// Mock apiClient methods
vi.mock('../services/apiClient', () => ({
  default: {
    analyzeCode: vi.fn(),
    createReview: vi.fn(),
    getReviewById: vi.fn(),
    applyFix: vi.fn().mockResolvedValue({ success: true }),
    undoFix: vi.fn().mockResolvedValue({ success: true }),
    getSecurityReview: vi.fn(),
    getPerformanceReview: vi.fn()
  }
}));

describe('Phase 11: Editor Apply Fix & Undo Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
  });

  // TEST 1: Apply Fix Modal Rendering and Preview
  it('Test 1 (ApplyFixModal Rendering): displays line coordinates, current code to replace, and proposed snippet', () => {
    const mockFinding = {
      id: 'finding-1',
      ruleId: 'SEC-INJ-001',
      title: 'SQL Injection via String Concatenation',
      severity: 'CRITICAL',
      lineStart: 3,
      lineEnd: 3,
      originalSnippet: 'query = "SELECT * FROM users WHERE name = \'" + user + "\'"',
      suggestedSnippet: 'cursor.execute("SELECT * FROM users WHERE name = ?", (user,))',
      explanation: 'Unsanitized user input concatenated directly into SQL statement.',
      remediation: 'Use parameterized queries.'
    };

    const initialCode = `import sqlite3\nconn = sqlite3.connect("db")\nquery = "SELECT * FROM users WHERE name = '" + user + "'"\nconn.execute(query)`;

    const handleConfirm = vi.fn();
    const handleCancel = vi.fn();

    render(
      <ApplyFixModal
        isOpen={true}
        finding={mockFinding}
        code={initialCode}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText(/Review & Apply Proposed Fix/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Lines 3–3/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('SEC-INJ-001')).toBeInTheDocument();
    expect(screen.getByTestId('preview-current-code')).toHaveTextContent(mockFinding.originalSnippet);
    expect(screen.getByTestId('preview-suggested-code')).toHaveTextContent(mockFinding.suggestedSnippet);

    // Cancel triggers callback
    fireEvent.click(screen.getByText('Cancel'));
    expect(handleCancel).toHaveBeenCalledTimes(1);

    // Confirm triggers callback
    fireEvent.click(screen.getByTestId('confirm-apply-fix-button'));
    expect(handleConfirm).toHaveBeenCalledWith(mockFinding);
  });

  // TEST 2: FindingsPanel Only Shows Apply Fix When suggestedSnippet Exists
  it('Test 2 (FindingsPanel Apply Fix Visibility): shows Apply Fix button only when suggestedSnippet is present', () => {
    const findingWithFix = {
      id: 'finding-with-fix',
      ruleId: 'SEC-CRY-001',
      title: 'Insecure MD5 Hash Function',
      severity: 'HIGH',
      lineStart: 2,
      lineEnd: 2,
      originalSnippet: 'hash = hashlib.md5(data.encode())',
      suggestedSnippet: 'hash = hashlib.sha256(data.encode())'
    };

    const findingWithoutFix = {
      id: 'finding-without-fix',
      ruleId: 'QUAL-STYLE-002',
      title: 'Unused Variable Detected',
      severity: 'INFO',
      lineStart: 5,
      lineEnd: 5,
      originalSnippet: 'temp = 123',
      suggestedSnippet: '' // No fix snippet
    };

    const mockAnalysis = {
      scoring: { overallScore: 80, grade: 'B' },
      metrics: { totalLines: 10, severityCounts: { high: 1, info: 1 } },
      findings: [findingWithFix, findingWithoutFix]
    };

    const handleApply = vi.fn();

    render(
      <FindingsPanel
        analysisResult={mockAnalysis}
        onRequestApplyFix={handleApply}
        appliedFixIds={[]}
      />
    );

    // Finding with fix has "Apply Fix" button
    expect(screen.getByTestId('apply-fix-btn-finding-with-fix')).toBeInTheDocument();

    // Finding without fix does NOT have "Apply Fix" button
    expect(screen.queryByTestId('apply-fix-btn-finding-without-fix')).not.toBeInTheDocument();
  });

  // TEST 3: FindingsPanel Shows "Applied" Badge and Undo When Fix is in appliedFixIds
  it('Test 3 (FindingsPanel Applied State): shows Applied badge and inline Undo button when fix is applied', () => {
    const finding = {
      id: 'finding-101',
      ruleId: 'SEC-INJ-001',
      title: 'SQL Injection',
      severity: 'CRITICAL',
      lineStart: 4,
      lineEnd: 4,
      suggestedSnippet: 'cursor.execute(query, (id,))'
    };

    const mockAnalysis = {
      scoring: { overallScore: 70, grade: 'C' },
      metrics: { totalLines: 10 },
      findings: [finding]
    };

    const handleUndo = vi.fn();

    render(
      <FindingsPanel
        analysisResult={mockAnalysis}
        appliedFixIds={['finding-101']}
        onUndoFix={handleUndo}
      />
    );

    expect(screen.getByTestId('badge-applied-finding-101')).toBeInTheDocument();
    expect(screen.getByText('Applied')).toBeInTheDocument();

    const undoBtn = screen.getByTestId('undo-fix-finding-101');
    expect(undoBtn).toBeInTheDocument();

    fireEvent.click(undoBtn);
    expect(handleUndo).toHaveBeenCalledWith('finding-101');
  });

  // TEST 4: EditorToolbar Undo Button Disabled When Stack is Empty
  it('Test 4 (EditorToolbar Undo Fix): disables Undo button when stack count is 0 and enables when count > 0', () => {
    const handleUndo = vi.fn();

    const { rerender } = render(
      <EditorToolbar
        language="python"
        fileName="test.py"
        code="print('hello')"
        undoStackCount={0}
        onUndoFix={handleUndo}
      />
    );

    const undoBtn = screen.getByTestId('undo-fix-toolbar-button');
    expect(undoBtn).toBeDisabled();

    // Rerender with 2 items in undo stack
    rerender(
      <EditorToolbar
        language="python"
        fileName="test.py"
        code="print('hello')"
        undoStackCount={2}
        onUndoFix={handleUndo}
      />
    );

    expect(undoBtn).not.toBeDisabled();
    expect(screen.getByTestId('undo-count-badge')).toHaveTextContent('2');

    fireEvent.click(undoBtn);
    expect(handleUndo).toHaveBeenCalledTimes(1);
  });

  // TEST 5: Full E2E Flow: Apply Fix Replaces Exact Line Range & Preserves Unrelated Code
  it('Test 5 (Full E2E Flow): applying fix replaces exact line range and preserves surrounding code', async () => {
    const initialCode = `def fetch_record(user_id):
    conn = get_db()
    query = "SELECT * FROM users WHERE id = " + user_id
    cursor = conn.cursor()
    return cursor.execute(query)
`;

    // Mock static analysis response
    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: {
        scoring: { overallScore: 70, grade: 'C' },
        metrics: { totalLines: 5, severityCounts: { critical: 1 } },
        findings: [
          {
            id: 'sql-inj-finding',
            ruleId: 'SEC-INJ-001',
            title: 'SQL Injection Vulnerability',
            severity: 'CRITICAL',
            lineStart: 3,
            lineEnd: 3,
            originalSnippet: '    query = "SELECT * FROM users WHERE id = " + user_id',
            suggestedSnippet: '    query = "SELECT * FROM users WHERE id = ?"\n    params = (user_id,)',
            explanation: 'String concatenation into SQL statement.'
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    // Wait for editor to render and set initial code
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, { target: { value: initialCode } });

    // Click Analyze button to populate findings
    const analyzeBtn = screen.getByLabelText(/Analyze code/i);
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('finding-card-sql-inj-finding')).toBeInTheDocument();
    });

    // Verify "Apply Fix" button is visible and click it
    const applyFixBtn = screen.getByTestId('apply-fix-btn-sql-inj-finding');
    fireEvent.click(applyFixBtn);

    // Confirm modal appears with before/after diff preview
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
    expect(screen.getByTestId('preview-suggested-code')).toHaveTextContent('query = "SELECT * FROM users WHERE id = ?"');

    // Confirm the fix
    const confirmBtn = screen.getByTestId('confirm-apply-fix-button');
    fireEvent.click(confirmBtn);

    // Verify modal is dismissed and success banner is shown
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.getByTestId('fix-feedback-banner')).toBeInTheDocument();
    });

    // Check editor content: lines 1-2 and line 4-5 must be preserved character-for-character
    const updatedValue = textarea.value;
    expect(updatedValue).toContain('def fetch_record(user_id):');
    expect(updatedValue).toContain('conn = get_db()');
    expect(updatedValue).toContain('query = "SELECT * FROM users WHERE id = ?"');
    expect(updatedValue).toContain('params = (user_id,)');
    expect(updatedValue).toContain('cursor = conn.cursor()');
    expect(updatedValue).toContain('return cursor.execute(query)');

    // Verify Undo Fix button in toolbar is now active
    const undoToolbarBtn = screen.getByTestId('undo-fix-toolbar-button');
    expect(undoToolbarBtn).not.toBeDisabled();
    expect(screen.getByTestId('undo-count-badge')).toHaveTextContent('1');

    // Click Undo Fix
    fireEvent.click(undoToolbarBtn);

    // Code is restored to exact initial code
    expect(textarea.value).toEqual(initialCode);
    expect(screen.getByTestId('fix-feedback-banner')).toHaveTextContent(/Editor code restored/i);
  });

  // TEST 6: Multiple Sequential Fixes & LIFO Undo Order
  it('Test 6 (Multiple Fixes & LIFO Undo): supports multiple sequential fixes and undoes in reverse order', async () => {
    const initialCode = `line1
line2
line3
line4
line5`;

    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: {
        scoring: { overallScore: 60, grade: 'D' },
        metrics: { totalLines: 5, severityCounts: { critical: 2 } },
        findings: [
          {
            id: 'fix-1',
            ruleId: 'RULE-1',
            title: 'Fix Line 2',
            severity: 'HIGH',
            lineStart: 2,
            lineEnd: 2,
            suggestedSnippet: 'fixed_line2'
          },
          {
            id: 'fix-2',
            ruleId: 'RULE-2',
            title: 'Fix Line 4',
            severity: 'HIGH',
            lineStart: 4,
            lineEnd: 4,
            suggestedSnippet: 'fixed_line4'
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, { target: { value: initialCode } });

    fireEvent.click(screen.getByLabelText(/Analyze code/i));

    await waitFor(() => {
      expect(screen.getByTestId('apply-fix-btn-fix-1')).toBeInTheDocument();
      expect(screen.getByTestId('apply-fix-btn-fix-2')).toBeInTheDocument();
    });

    // Apply Fix 1 (Line 2)
    fireEvent.click(screen.getByTestId('apply-fix-btn-fix-1'));
    fireEvent.click(screen.getByTestId('confirm-apply-fix-button'));

    await waitFor(() => {
      expect(screen.getByTestId('badge-applied-fix-1')).toBeInTheDocument();
    });
    expect(textarea.value).toContain('fixed_line2');

    // Apply Fix 2 (Line 4)
    fireEvent.click(screen.getByTestId('apply-fix-btn-fix-2'));
    fireEvent.click(screen.getByTestId('confirm-apply-fix-button'));

    await waitFor(() => {
      expect(screen.getByTestId('badge-applied-fix-2')).toBeInTheDocument();
    });
    expect(textarea.value).toContain('fixed_line4');
    expect(screen.getByTestId('undo-count-badge')).toHaveTextContent('2');

    // First Undo: Undoes Fix 2 (LIFO)
    const undoBtn = screen.getByTestId('undo-fix-toolbar-button');
    fireEvent.click(undoBtn);

    expect(textarea.value).toContain('fixed_line2');
    expect(textarea.value).not.toContain('fixed_line4');
    expect(screen.getByTestId('undo-count-badge')).toHaveTextContent('1');

    // Second Undo: Undoes Fix 1 (Returns to original buffer)
    fireEvent.click(undoBtn);
    expect(textarea.value).toEqual(initialCode);
    expect(undoBtn).toBeDisabled();
  });

  // TEST 7: Range Boundary Validation Error Handling
  it('Test 7 (Range Boundary Validation): rejects fix with line range exceeding buffer and shows error banner', async () => {
    const initialCode = `print('short script')`;

    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: {
        scoring: { overallScore: 50, grade: 'F' },
        metrics: { totalLines: 1 },
        findings: [
          {
            id: 'out-of-bounds-finding',
            ruleId: 'SEC-001',
            title: 'Out of Bounds Issue',
            severity: 'CRITICAL',
            lineStart: 50, // Out of bounds for 1-line script
            lineEnd: 55,
            suggestedSnippet: 'some code'
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, { target: { value: initialCode } });

    fireEvent.click(screen.getByLabelText(/Analyze code/i));

    await waitFor(() => {
      expect(screen.getByTestId('apply-fix-btn-out-of-bounds-finding')).toBeInTheDocument();
    });

    // Click Apply Fix for out of bounds finding
    fireEvent.click(screen.getByTestId('apply-fix-btn-out-of-bounds-finding'));

    // Should NOT open modal, should show error feedback
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('fix-feedback-banner')).toBeInTheDocument();
    expect(screen.getByTestId('fix-feedback-banner')).toHaveTextContent(/exceeds current editor line count/i);
  });

  // TEST 8: Review History Deep Link Loads currentCode & appliedFixes
  it('Test 8 (Review History Consistency): restores currentCode and applied fixes when loading review by ID', async () => {
    const originalRawCode = 'SELECT * FROM users WHERE name = ' + 'admin';
    const savedCurrentCode = 'SELECT * FROM users WHERE name = ?';

    apiClient.getReviewById.mockResolvedValueOnce({
      success: true,
      data: {
        review: {
          _id: '507f1f77bcf86cd799439011',
          language: 'python',
          rawCode: originalRawCode,
          currentCode: savedCurrentCode,
          appliedFixes: [
            {
              issueId: '507f1f77bcf86cd799439099',
              ruleId: 'SEC-INJ-001',
              lineStart: 1,
              lineEnd: 1,
              appliedSnippet: savedCurrentCode
            }
          ]
        },
        analysis: {
          overallScore: 85,
          grade: 'B'
        },
        issues: [
          {
            _id: '507f1f77bcf86cd799439099',
            id: '507f1f77bcf86cd799439099',
            ruleId: 'SEC-INJ-001',
            title: 'SQL Injection',
            severity: 'CRITICAL',
            lineStart: 1,
            lineEnd: 1,
            suggestedSnippet: savedCurrentCode
          }
        ]
      }
    });

    render(
      <MemoryRouter initialEntries={['/code-review?reviewId=507f1f77bcf86cd799439011']}>
        <CodeReview />
      </MemoryRouter>
    );

    // Wait for review to load
    await waitFor(() => {
      expect(apiClient.getReviewById).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    // Editor buffer should load currentCode (with applied fixes), not rawCode
    await waitFor(() => {
      expect(textarea.value).toEqual(savedCurrentCode);
    });

    // Finding card should reflect the applied badge
    await waitFor(() => {
      expect(screen.getByTestId('badge-applied-507f1f77bcf86cd799439099')).toBeInTheDocument();
    });
  });

  // TEST 9: Indentation Preservation on Fix Application
  it('Test 9 (Indentation Preservation): preserves original indentation when applying unindented snippet', async () => {
    const initialCode = [
      '#include <stdio.h>',
      'void login() {',
      '    char password[64];',
      '    gets(password);',
      '    authenticate(password);',
      '}'
    ].join('\n');

    apiClient.analyzeCode.mockResolvedValueOnce({
      success: true,
      data: {
        scoring: { overallScore: 75, grade: 'B' },
        metrics: { totalLines: 6, severityCounts: { critical: 1 } },
        findings: [
          {
            id: 'c-gets-finding',
            ruleId: 'RISK-C-002',
            title: 'Obsolete Insecure Input Function (gets)',
            severity: 'CRITICAL',
            lineStart: 4,
            lineEnd: 4,
            originalSnippet: '    gets(password);',
            suggestedSnippet: 'fgets(password, sizeof(password), stdin);' // unindented snippet
          }
        ]
      }
    });

    render(
      <MemoryRouter>
        <CodeReview />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    fireEvent.change(textarea, { target: { value: initialCode } });

    const analyzeBtn = screen.getByLabelText(/Analyze code/i);
    fireEvent.click(analyzeBtn);

    await waitFor(() => {
      expect(screen.getByTestId('finding-card-c-gets-finding')).toBeInTheDocument();
    });

    // Apply the fix
    fireEvent.click(screen.getByTestId('apply-fix-btn-c-gets-finding'));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-apply-fix-button'));
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Verify line 4 in updated editor preserves the 4 spaces of indentation
    const lines = textarea.value.split('\n');
    expect(lines[3]).toBe('    fgets(password, sizeof(password), stdin);');
    expect(lines[1]).toBe('void login() {');
    expect(lines[2]).toBe('    char password[64];');
    expect(lines[4]).toBe('    authenticate(password);');
  });
});
