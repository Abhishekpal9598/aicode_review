import * as monaco from 'monaco-editor/editor/editor.api';
import { loader } from '@monaco-editor/react';

// Specific syntax contributions for the 6 supported languages: C, C++, Java, Python, JavaScript, TypeScript
import 'monaco-editor/languages/definitions/cpp/register.js'; // Registers 'c' and 'cpp'
import 'monaco-editor/languages/definitions/java/register.js'; // Registers 'java'
import 'monaco-editor/languages/definitions/python/register.js'; // Registers 'python'
import 'monaco-editor/languages/definitions/javascript/register.js'; // Registers 'javascript'
import 'monaco-editor/languages/definitions/typescript/register.js'; // Registers 'typescript'

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
