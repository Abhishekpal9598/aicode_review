import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import CodeReview from '../pages/CodeReview';
import {
  SUPPORTED_LANGUAGES,
  PYTHON_STARTER,
  JAVASCRIPT_STARTER,
  C_STARTER,
  CPP_STARTER
} from '../utils/languageMap';
import { SESSION_STORAGE_KEY } from '../hooks/useEditorState';

// Mock monaco-editor and @monaco-editor/react for JSDOM
vi.mock('@monaco-editor/react', () => ({
  default: ({ value, language, theme, onChange, options }) => (
    <div
      data-testid="monaco-editor-container"
      data-language={language}
      data-theme={theme}
      data-font={options?.fontFamily}
    >
      <textarea
        data-testid="monaco-editor-textarea"
        aria-label="Code Editor"
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
      />
    </div>
  ),
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

describe('Phase 6: Monaco Code Editor Integration Tests (Tests 1 - 12)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    // Mock navigator.clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined)
      }
    });
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  // TEST 1: Monaco Editor Mounting & Theme Configuration
  it('Test 1 (Monaco Editor Mount & Theme): renders editor with cybernetic-dark theme and default Python template', async () => {
    render(<CodeReview />);

    // Wait for lazy loaded MonacoWrapper to resolve
    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-container')).toBeInTheDocument();
    });

    const container = screen.getByTestId('monaco-editor-container');
    expect(container).toHaveAttribute('data-theme', 'cybernetic-dark');
    expect(container).toHaveAttribute('data-language', 'python');
    expect(container.getAttribute('data-font')).toContain('JetBrains Mono');

    const textarea = screen.getByTestId('monaco-editor-textarea');
    expect(textarea.value).toContain('def two_sum');
    expect(screen.getByText('main.py')).toBeInTheDocument();
  });

  // TEST 2: Language Selector Rendering
  it('Test 2 (Language Selector Rendering): displays all 6 supported programming languages', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByLabelText(/Select programming language/i)).toBeInTheDocument();
    });

    const selectorButton = screen.getByLabelText(/Select programming language/i);
    fireEvent.click(selectorButton);

    const listbox = screen.getByRole('listbox');
    expect(listbox).toBeInTheDocument();

    // Verify all 6 languages exist within the listbox
    SUPPORTED_LANGUAGES.forEach((lang) => {
      expect(within(listbox).getByText(lang.label)).toBeInTheDocument();
    });
  });

  // TEST 3: Language Switching Rules
  it('Test 3 (Language Switching Rules): swaps template when untouched, preserves code when modified, remains empty when cleared', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const selectorButton = screen.getByLabelText(/Select programming language/i);

    // Sub-case A: Untouched starter template switches to new language starter template
    fireEvent.click(selectorButton);
    fireEvent.click(screen.getByRole('option', { name: /JavaScript/i }));

    const textarea = screen.getByTestId('monaco-editor-textarea');
    expect(textarea.value).toContain('function debounce');
    expect(screen.getByText('index.js')).toBeInTheDocument();

    // Sub-case B: User-modified code is preserved when changing language
    fireEvent.change(textarea, { target: { value: 'const customUserCode = 42;' } });
    expect(textarea.value).toBe('const customUserCode = 42;');

    fireEvent.click(selectorButton);
    fireEvent.click(screen.getByRole('option', { name: /TypeScript/i }));

    // Code MUST be preserved exactly
    expect(textarea.value).toBe('const customUserCode = 42;');
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'typescript');

    // Sub-case C: Empty editor remains empty when changing language
    const clearButton = screen.getByLabelText(/Clear code/i);
    fireEvent.click(clearButton);
    expect(textarea.value).toBe('');

    fireEvent.click(selectorButton);
    fireEvent.click(screen.getByRole('option', { name: /Python/i }));
    expect(textarea.value).toBe('');
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'python');
  });

  // TEST 4: Code Typing & Real-time Telemetry
  it('Test 4 (Code Typing & Telemetry): updates code state, LOC counter, and character count in status bar', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    const multiLineCode = 'line 1\nline 2\nline 3\nline 4';

    fireEvent.change(textarea, { target: { value: multiLineCode } });

    expect(textarea.value).toBe(multiLineCode);

    // Verify status bar telemetry
    const statusBar = screen.getByLabelText('Editor Status Bar');
    expect(statusBar).toHaveTextContent('4 lines');
    expect(statusBar).toHaveTextContent(`${multiLineCode.length} chars`);
    expect(statusBar).toHaveTextContent('Draft (Session)');
  });

  // TEST 5: Valid File Upload (.py / .ts)
  it('Test 5 (Valid File Upload): reads file content, auto-detects language, and updates filename', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('code-file-input')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('code-file-input');
    const validPyCode = 'print("Uploaded python file")\n';
    const file = new File([validPyCode], 'search_service.py', { type: 'text/x-python' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } });
    });

    await waitFor(() => {
      expect(screen.getByText('search_service.py')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor-textarea').value).toBe(validPyCode);
    });

    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'python');
  });

  // TEST 6: Ambiguous .h File Upload Resolution
  it('Test 6 (Ambiguous .h Header Resolution): defaults .h to C and allows seamless manual switch to C++ without losing code', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('code-file-input')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('code-file-input');
    const headerCode = '#pragma once\nvoid process(int x);\n';
    const headerFile = new File([headerCode], 'common_types.h', { type: 'text/plain' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [headerFile] } });
    });

    await waitFor(() => {
      expect(screen.getByText('common_types.h')).toBeInTheDocument();
      expect(screen.getByTestId('monaco-editor-textarea').value).toBe(headerCode);
    });

    // Verify .h defaults to C
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'c');

    // Manually switch to C++
    const selectorButton = screen.getByLabelText(/Select programming language/i);
    fireEvent.click(selectorButton);
    fireEvent.click(screen.getByRole('option', { name: /C\+\+/i }));

    // Code MUST be preserved exactly and language updated to C++
    expect(screen.getByTestId('monaco-editor-textarea').value).toBe(headerCode);
    expect(screen.getByTestId('monaco-editor-container')).toHaveAttribute('data-language', 'cpp');
  });

  // TEST 7: Unsupported Extension Rejection
  it('Test 7 (Unsupported Extension Rejection): rejects invalid file formats before reading and leaves buffer intact', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const initialCode = screen.getByTestId('monaco-editor-textarea').value;
    const fileInput = screen.getByTestId('code-file-input');
    const invalidFile = new File(['binary executable data'], 'malware.exe', { type: 'application/octet-stream' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [invalidFile] } });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/Unsupported file format '\.exe'/i);
    });

    // Buffer must remain intact
    expect(screen.getByTestId('monaco-editor-textarea').value).toBe(initialCode);
  });

  // TEST 8: Oversized File Rejection (> 1 MB)
  it('Test 8 (Oversized File Rejection): rejects files exceeding 1 MB limit and displays size in banner', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('code-file-input')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('code-file-input');
    // Create oversized file: 1.2 MB
    const oversizedBlob = new Blob([new Uint8Array(1.2 * 1024 * 1024)], { type: 'text/plain' });
    const oversizedFile = new File([oversizedBlob], 'huge_dataset.py', { type: 'text/x-python' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [oversizedFile] } });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/File size exceeds 1 MB limit/i);
    });
  });

  // TEST 9: Empty File Rejection (0 Bytes)
  it('Test 9 (Empty File Rejection): rejects 0-byte file and displays descriptive error', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('code-file-input')).toBeInTheDocument();
    });

    const fileInput = screen.getByTestId('code-file-input');
    const emptyFile = new File([], 'empty.js', { type: 'text/javascript' });

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [emptyFile] } });
    });

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/The selected file is empty \(0 bytes\)/i);
    });
  });

  // TEST 10: Clear Code Action
  it('Test 10 (Clear Code Action): empties buffer completely and updates dirty indicator', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const clearButton = screen.getByLabelText(/Clear code/i);
    fireEvent.click(clearButton);

    const textarea = screen.getByTestId('monaco-editor-textarea');
    expect(textarea.value).toBe('');

    const statusBar = screen.getByLabelText('Editor Status Bar');
    expect(statusBar).toHaveTextContent('0 lines');
    expect(statusBar).toHaveTextContent('0 chars');
  });

  // TEST 11: Reset Editor Action with Destruction Guard
  it('Test 11 (Reset Editor with Destruction Guard): prompts confirmation when dirty and preserves code if cancelled', async () => {
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    const textarea = screen.getByTestId('monaco-editor-textarea');
    const customCode = 'def important_algorithm():\n    return 100';
    fireEvent.change(textarea, { target: { value: customCode } });

    const resetButton = screen.getByLabelText(/Reset editor/i);
    fireEvent.click(resetButton);

    // Verify destruction guard dialog appears
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText('Reset Editor?')).toBeInTheDocument();

    // Click cancel -> code MUST NOT be destroyed
    const cancelButton = screen.getByRole('button', { name: /Cancel/i });
    fireEvent.click(cancelButton);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(textarea.value).toBe(customCode);

    // Click reset again and confirm
    fireEvent.click(resetButton);
    const confirmButton = screen.getByRole('button', { name: /Confirm Reset/i });
    fireEvent.click(confirmButton);

    // Verify starter template restored
    expect(textarea.value).toContain('def two_sum');
  });

  // TEST 12: Versioned Session Persistence & Resilience
  it('Test 12 (Versioned Session Persistence & Resilience): restores draft from storage and recovers gracefully from corrupted JSON', async () => {
    // 1. Pre-seed valid versioned session draft
    const seededDraft = {
      version: 1,
      code: 'class SeededModel:\n    pass\n',
      language: 'python',
      fileName: 'seeded.py',
      isDirty: true
    };
    sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(seededDraft));

    const { unmount } = render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    expect(screen.getByTestId('monaco-editor-textarea').value).toBe(seededDraft.code);
    expect(screen.getByText('seeded.py')).toBeInTheDocument();

    unmount();

    // 2. Corrupt sessionStorage with invalid JSON
    sessionStorage.setItem(SESSION_STORAGE_KEY, '{ invalid_malformed_json :::');

    // Rendering should not crash and should safely fall back to default initial state
    render(<CodeReview />);

    await waitFor(() => {
      expect(screen.getByTestId('monaco-editor-textarea')).toBeInTheDocument();
    });

    expect(screen.getByTestId('monaco-editor-textarea').value).toContain('def two_sum');
  });
});
