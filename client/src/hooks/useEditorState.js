import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  SUPPORTED_LANGUAGES,
  getLanguageFromFileName,
  isSupportedExtension,
  formatBytes,
  computeTelemetry
} from '../utils/languageMap';
import {
  detectLanguage,
  detectLanguageFromContent,
  detectLanguageFromExtension,
  CONFIDENCE_LEVELS
} from '../services/languageDetector';

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
      typeof parsed.code === 'string'
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

  const defaultLangConfig =
    SUPPORTED_LANGUAGES.find((l) => l.id === 'python') || SUPPORTED_LANGUAGES[0];

  const initialCode = initialDraft ? initialDraft.code : defaultLangConfig.starterCode;
  const initialFileName = initialDraft ? initialDraft.fileName : defaultLangConfig.defaultFileName;

  // Selected mode: 'auto' (default) or 'manual'
  const [selectedMode, setSelectedMode] = useState(() => {
    if (initialDraft && initialDraft.selectedMode) {
      return initialDraft.selectedMode;
    }
    // If draft explicitly has a non-auto language without selectedMode, honor manual
    if (initialDraft && initialDraft.language && initialDraft.isManualOverride) {
      return 'manual';
    }
    return 'auto';
  });

  // Explicit user manual selection (null when selectedMode === 'auto')
  const [manualLanguage, setManualLanguage] = useState(() => {
    if (initialDraft && initialDraft.manualLanguage) {
      return initialDraft.manualLanguage;
    }
    if (initialDraft && initialDraft.selectedMode === 'manual' && initialDraft.language) {
      return initialDraft.language;
    }
    return null;
  });

  // Initial detection calculation
  const initialDetection = useMemo(() => {
    return detectLanguage(initialCode, initialFileName);
  }, [initialCode, initialFileName]);

  const [code, setCode] = useState(initialCode);
  const [fileName, setFileName] = useState(initialFileName);
  const [isDirty, setIsDirty] = useState(
    initialDraft ? Boolean(initialDraft.isDirty) : false
  );
  const [detectedLanguage, setDetectedLanguage] = useState(
    initialDetection.language || 'python'
  );
  const [detectionConfidence, setDetectionConfidence] = useState(
    initialDetection.confidence || CONFIDENCE_LEVELS.HIGH
  );
  const [detectionSource, setDetectionSource] = useState(
    initialDetection.source || 'content'
  );

  const [error, setError] = useState(null);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  // Derive effective language
  const effectiveLanguage = useMemo(() => {
    if (selectedMode === 'manual' && manualLanguage) {
      return manualLanguage;
    }
    return detectedLanguage || 'python';
  }, [selectedMode, manualLanguage, detectedLanguage]);

  // Derive detection status
  const detectionStatus = useMemo(() => {
    if (selectedMode === 'manual') {
      return 'manual'; // Manually Selected
    }
    if (detectionConfidence === CONFIDENCE_LEVELS.UNCERTAIN) {
      return 'uncertain'; // Detection Uncertain
    }
    return 'auto'; // Auto Detected
  }, [selectedMode, detectionConfidence]);

  const isManualOverride = selectedMode === 'manual';

  // Compute live editor telemetry
  const telemetry = useMemo(() => computeTelemetry(code), [code]);

  // Sync draft to sessionStorage on state changes
  useEffect(() => {
    writeDraftToStorage({
      version: 1,
      code,
      language: effectiveLanguage,
      selectedMode,
      manualLanguage,
      detectedLanguage,
      isManualOverride,
      fileName,
      isDirty,
      updatedAt: new Date().toISOString()
    });
  }, [
    code,
    effectiveLanguage,
    selectedMode,
    manualLanguage,
    detectedLanguage,
    isManualOverride,
    fileName,
    isDirty
  ]);

  /**
   * Code typing / change handler.
   * If in Auto Detect mode, re-runs language detection on content.
   * If user manually selected a language, NEVER overrides manual selection.
   */
  const updateCode = useCallback(
    (newCode) => {
      const val = typeof newCode === 'string' ? newCode : '';
      setCode(val);
      setIsDirty(true);

      if (selectedMode === 'auto') {
        const result = detectLanguageFromContent(val);
        setDetectionConfidence(result.confidence);
        setDetectionSource('content');

        if (result.language && result.confidence !== CONFIDENCE_LEVELS.UNCERTAIN) {
          setDetectedLanguage(result.language);
          // Adapt default starter file extension if fileName is a standard starter name
          const targetLangConfig = SUPPORTED_LANGUAGES.find((l) => l.id === result.language);
          if (targetLangConfig) {
            setFileName((prevName) => {
              const isDefaultName = SUPPORTED_LANGUAGES.some((l) => l.defaultFileName === prevName);
              return isDefaultName ? targetLangConfig.defaultFileName : prevName;
            });
          }
        } else if (result.confidence === CONFIDENCE_LEVELS.UNCERTAIN) {
          // Keep current language but flag confidence as uncertain
          if (result.language) {
            setDetectedLanguage(result.language);
          }
        }
      }
    },
    [selectedMode]
  );

  /**
   * Language selector change handler.
   * Supports 'auto' or explicit language id ('python', 'javascript', etc.).
   *
   * Rules:
   * 1. 'auto': Sets selectedMode to 'auto', clears manual override, re-runs detection.
   * 2. Specific language: Sets selectedMode to 'manual', records manualLanguage.
   *    - Empty buffer: update language & default filename.
   *    - Untouched starter template (!isDirty): load target starter template.
   *    - User-modified code (isDirty): PRESERVE complete code buffer, update grammar only.
   */
  const changeLanguage = useCallback(
    (newLangId) => {
      if (newLangId === 'auto') {
        setSelectedMode('auto');
        setManualLanguage(null);

        // Immediate detection on current code and filename
        const result = detectLanguage(code, fileName);
        setDetectionConfidence(result.confidence);
        setDetectionSource(result.source);
        if (result.language) {
          setDetectedLanguage(result.language);
        }
        return;
      }

      const targetLang = SUPPORTED_LANGUAGES.find((l) => l.id === newLangId);
      if (!targetLang) return;

      setSelectedMode('manual');
      setManualLanguage(targetLang.id);

      const isBufferEmpty = code.trim() === '';

      if (isBufferEmpty) {
        // Case 1: Empty buffer -> preserve empty state, update filename
        setFileName(targetLang.defaultFileName);
      } else if (!isDirty) {
        // Case 2: Untouched starter template -> load new template & update filename
        setCode(targetLang.starterCode);
        setFileName(targetLang.defaultFileName);
      } else {
        // Case 3: User-modified code -> PRESERVE complete code buffer, update language only
        const currentLangConfig = SUPPORTED_LANGUAGES.find((l) => l.id === effectiveLanguage);
        if (currentLangConfig && fileName === currentLangConfig.defaultFileName) {
          setFileName(targetLang.defaultFileName);
        }
      }
    },
    [code, isDirty, effectiveLanguage, fileName]
  );

  /**
   * Switch back to Auto Detect mode helper
   */
  const resetToAuto = useCallback(() => {
    changeLanguage('auto');
  }, [changeLanguage]);

  /**
   * File upload handler with strict client-side validation
   */
  const handleFileUpload = useCallback(
    (file) => {
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
          const msg = `Unsupported file format '${ext}'. Supported formats: .c, .h, .cpp, .hpp, .cc, .cxx, .java, .py, .js, .jsx, .ts, .tsx`;
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

            // Detect language from extension and content
            const extDetection = detectLanguageFromExtension(file.name, content);
            const resolvedLang = extDetection.language || 'c';

            setCode(content);
            setFileName(file.name);
            setIsDirty(true);
            setError(null);

            setDetectedLanguage(resolvedLang);
            setDetectionConfidence(extDetection.confidence || CONFIDENCE_LEVELS.HIGH);
            setDetectionSource('extension');

            // If user was in manual mode, set manualLanguage to the file's language
            // so Monaco highlights the uploaded file's language immediately
            if (selectedMode === 'manual') {
              setManualLanguage(resolvedLang);
            }

            resolve({ success: true, fileName: file.name, language: resolvedLang });
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
    },
    [selectedMode]
  );

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
      const currentLang =
        SUPPORTED_LANGUAGES.find((l) => l.id === effectiveLanguage) || defaultLangConfig;
      setCode(currentLang.starterCode);
      setFileName(currentLang.defaultFileName);
      setIsDirty(false);
      setError(null);
    }
  }, [code, isDirty, effectiveLanguage, defaultLangConfig]);

  /**
   * Confirms reset and restores clean starter template
   */
  const confirmReset = useCallback(() => {
    const currentLang =
      SUPPORTED_LANGUAGES.find((l) => l.id === effectiveLanguage) || defaultLangConfig;
    setCode(currentLang.starterCode);
    setFileName(currentLang.defaultFileName);
    setIsDirty(false);
    setError(null);
    setIsResetConfirmOpen(false);
  }, [effectiveLanguage, defaultLangConfig]);

  const cancelReset = useCallback(() => {
    setIsResetConfirmOpen(false);
  }, []);

  const dismissError = useCallback(() => {
    setError(null);
  }, []);

  return {
    code,
    // language is effectiveLanguage for full backward compatibility
    language: effectiveLanguage,
    effectiveLanguage,
    selectedMode,
    manualLanguage,
    detectedLanguage,
    detectionConfidence,
    detectionSource,
    detectionStatus,
    isManualOverride,
    fileName,
    isDirty,
    error,
    telemetry,
    isResetConfirmOpen,
    updateCode,
    changeLanguage,
    resetToAuto,
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
