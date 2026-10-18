import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SUPPORTED_LANGUAGES,
  getLanguageFromFileName,
  isSupportedExtension,
  formatBytes,
  computeTelemetry
} from '../utils/languageMap';

export const SESSION_STORAGE_KEY = 'aicode_editor_draft_v1';
export const MAX_FILE_SIZE_BYTES = 1024 * 1024; // 1 MB = 1,048,576 bytes

/**
 * Safely reads the draft state from sessionStorage.
 * Gracefully handles SecurityError, QuotaExceededError, and malformed JSON.
 */
function readDraftFromStorage() {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.code === 'string' &&
      typeof parsed.language === 'string'
    ) {
      return parsed;
    }
    // Clean up malformed payload
    window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    return null;
  } catch (err) {
    console.warn('[useEditorState] SessionStorage read error:', err);
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch (_) {
      // Ignore secondary error
    }
    return null;
  }
}

/**
 * Safely persists the draft state to sessionStorage.
 */
function writeDraftToStorage(draft) {
  if (typeof window === 'undefined' || !window.sessionStorage) {
    return;
  }
  try {
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(draft));
  } catch (err) {
    console.warn('[useEditorState] SessionStorage write error:', err);
  }
}

export function useEditorState() {
  // Check for existing draft in sessionStorage
  const initialDraft = useMemo(() => readDraftFromStorage(), []);

  const defaultLangConfig = SUPPORTED_LANGUAGES.find((l) => l.id === 'python') || SUPPORTED_LANGUAGES[0];

  const [code, setCode] = useState(
    initialDraft ? initialDraft.code : defaultLangConfig.starterCode
  );
  const [language, setLanguageState] = useState(
    initialDraft ? initialDraft.language : defaultLangConfig.id
  );
  const [fileName, setFileName] = useState(
    initialDraft ? initialDraft.fileName : defaultLangConfig.defaultFileName
  );
  const [isDirty, setIsDirty] = useState(
    initialDraft ? Boolean(initialDraft.isDirty) : false
  );
  const [error, setError] = useState(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Compute live editor telemetry
  const telemetry = useMemo(() => computeTelemetry(code), [code]);

  // Sync draft to sessionStorage on state changes
  useEffect(() => {
    writeDraftToStorage({
      version: 1,
      code,
      language,
      fileName,
      isDirty,
      updatedAt: new Date().toISOString()
    });
  }, [code, language, fileName, isDirty]);

  /**
   * Code typing / change handler
   */
  const updateCode = useCallback((newCode) => {
    const val = typeof newCode === 'string' ? newCode : '';
    setCode(val);
    setIsDirty(true);
  }, []);

  /**
   * Language switching logic following exact rules:
   * 1. Empty buffer: Switch language & default filename without adding starter template.
   * 2. Untouched starter template (!isDirty): Switch language, load new starter template, update filename.
   * 3. User-modified code (isDirty): PRESERVE complete code buffer, update language grammar only.
   */
  const changeLanguage = useCallback(
    (newLangId) => {
      const targetLang = SUPPORTED_LANGUAGES.find((l) => l.id === newLangId);
      if (!targetLang) return;

      const isBufferEmpty = code.trim() === '';

      if (isBufferEmpty) {
        // Case 1: Empty buffer -> preserve empty state, update language & filename
        setLanguageState(targetLang.id);
        setFileName(targetLang.defaultFileName);
      } else if (!isDirty) {
        // Case 2: Untouched starter template -> load new template & update filename
        setLanguageState(targetLang.id);
        setCode(targetLang.starterCode);
        setFileName(targetLang.defaultFileName);
      } else {
        // Case 3: User-modified code -> PRESERVE complete code buffer, update language only
        setLanguageState(targetLang.id);
        // If current filename is a default template name, adapt its extension
        const currentLangConfig = SUPPORTED_LANGUAGES.find((l) => l.id === language);
        if (currentLangConfig && fileName === currentLangConfig.defaultFileName) {
          setFileName(targetLang.defaultFileName);
        }
      }
    },
    [code, isDirty, language, fileName]
  );

  /**
   * File upload handler with strict client-side validation
   */
  const handleFileUpload = useCallback((file) => {
    return new Promise((resolve) => {
      setError(null);

      if (!file) {
        const msg = 'No file selected.';
        setError(msg);
        resolve({ success: false, error: msg });
        return;
      }

      // 1. Check file size
      if (file.size > MAX_FILE_SIZE_BYTES) {
        const msg = `File size exceeds 1 MB limit (size: ${formatBytes(file.size)}). Please select a smaller file.`;
        setError(msg);
        resolve({ success: false, error: msg });
        return;
      }

      // 2. Check empty file
      if (file.size === 0) {
        const msg = 'The selected file is empty (0 bytes). Please upload a valid source file.';
        setError(msg);
        resolve({ success: false, error: msg });
        return;
      }

      // 3. Check extension
      if (!isSupportedExtension(file.name)) {
        const dotIndex = file.name.lastIndexOf('.');
        const ext = dotIndex !== -1 ? file.name.slice(dotIndex) : 'unknown';
        const msg = `Unsupported file format '${ext}'. Supported formats: .c, .h, .cpp, .hpp, .java, .py, .js, .jsx, .ts, .tsx`;
        setError(msg);
        resolve({ success: false, error: msg });
        return;
      }

      // 4. Read file content as UTF-8
      const reader = new FileReader();

      reader.onload = (event) => {
        try {
          const content = event.target?.result;
          if (typeof content !== 'string') {
            throw new Error('Unable to parse file as text.');
          }

          // Map filename to language (.h defaults to C)
          const detectedLang = getLanguageFromFileName(file.name);
          const langId = detectedLang ? detectedLang.id : 'c';

          setCode(content);
          setLanguageState(langId);
          setFileName(file.name);
          setIsDirty(true);
          setError(null);
          resolve({ success: true, fileName: file.name });
        } catch (readErr) {
          const msg = 'Failed to read file. Please ensure the file is valid UTF-8 encoded text.';
          setError(msg);
          resolve({ success: false, error: msg });
        }
      };

      reader.onerror = () => {
        const msg = 'Failed to read file. An unexpected I/O error occurred.';
        setError(msg);
        resolve({ success: false, error: msg });
      };

      reader.readAsText(file, 'UTF-8');
    });
  }, []);

  /**
   * Clear buffer action (sets code to empty string, marks dirty)
   */
  const clearCode = useCallback(() => {
    setCode('');
    setIsDirty(true);
    setError(null);
  }, []);

  /**
   * Request reset: if dirty and non-empty, triggers confirmation guard
   */
  const requestReset = useCallback(() => {
    if (isDirty && code.trim() !== '') {
      setIsResetConfirmOpen(true);
    } else {
      // Pristine or empty; safe to reset directly
      const currentLang = SUPPORTED_LANGUAGES.find((l) => l.id === language) || defaultLangConfig;
      setCode(currentLang.starterCode);
      setFileName(currentLang.defaultFileName);
      setIsDirty(false);
      setError(null);
    }
  }, [code, isDirty, language, defaultLangConfig]);

  /**
   * Confirms reset and restores clean starter template
   */
  const confirmReset = useCallback(() => {
    const currentLang = SUPPORTED_LANGUAGES.find((l) => l.id === language) || defaultLangConfig;
    setCode(currentLang.starterCode);
    setFileName(currentLang.defaultFileName);
    setIsDirty(false);
    setError(null);
    setIsResetConfirmOpen(false);
  }, [language, defaultLangConfig]);

  const cancelReset = useCallback(() => {
    setIsResetConfirmOpen(false);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    code,
    language,
    fileName,
    isDirty,
    error,
    telemetry,
    isResetConfirmOpen,
    updateCode,
    changeLanguage,
    handleFileUpload,
    clearCode,
    requestReset,
    confirmReset,
    cancelReset,
    dismissError,
    setFileName
  };
}

export default useEditorState;
