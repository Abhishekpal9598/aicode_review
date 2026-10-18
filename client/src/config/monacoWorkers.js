import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';

// Single self-hosted editor worker handling syntax and editor operations
import editorWorker from 'monaco-editor/editor/editor.worker?worker';

let isConfigured = false;

export function configureMonaco() {
  if (isConfigured) return monaco;

  if (typeof window !== 'undefined') {
    window.MonacoEnvironment = {
      getWorker() {
        return new editorWorker();
      }
    };

    // Configure @monaco-editor/react to use local self-hosted monaco bundle
    loader.config({ monaco });
    isConfigured = true;
  }

  return monaco;
}

if (typeof window !== 'undefined') {
  configureMonaco();
}

export { monaco };
export default configureMonaco;
