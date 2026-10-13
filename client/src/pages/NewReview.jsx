import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Editor from '@monaco-editor/react';
import api from '../services/api';
import {
  Play,
  AlertTriangle,
  Sparkles,
  FileCode
} from 'lucide-react';

const SAMPLE_SNIPPETS = {
  javascript: `function getUser(userId) {
  // Vulnerable to SQL injection
  const query = "SELECT * FROM users WHERE id = " + userId;
  return db.query(query);
}

function processPayment(amount) {
  if (amount == "0") {
    console.log("Free transaction processed");
  }
}`,
  typescript: `interface User {
  id: string;
  role: string;
}

function verifyAdmin(user: any) {
  // Loose equality and unhandled types
  if (user.role == "admin") {
    console.log("Admin authorized: " + user.id);
    return true;
  }
  return false;
}`,
  python: `import os

def connect_db(user_input):
  # Insecure command execution
  cmd = "ping -c 1 " + user_input
  os.system(cmd)
  print("Ping executed")
`,
  java: `public class UserService {
    public void executeQuery(String userInput) {
        // Direct string concatenation in SQL
        String sql = "SELECT * FROM accounts WHERE name = '" + userInput + "'";
        System.out.println("Running query: " + sql);
    }
}`
};

export default function NewReview() {
  const [language, setLanguage] = useState('javascript');
  const [code, setCode] = useState(SAMPLE_SNIPPETS.javascript);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isServerMock, setIsServerMock] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Probe backend health check to check default mock status
    api.get('/health')
      .then((res) => {
        if (res.data.mock_mode) {
          setIsServerMock(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    setCode(SAMPLE_SNIPPETS[newLang] || '// Paste your code here');
  };

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/reviews', {
        code,
        language
      });

      const reviewId = res.data?.review?.id;
      if (reviewId) {
        navigate(`/reviews/${reviewId}`);
      } else {
        setError('Review completed but no ID was returned.');
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.details?.[0]?.message ||
          'Failed to analyze code.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner / Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-3">
            <h1 className="text-2xl font-bold text-white tracking-tight">Review Code Snippet</h1>
            {isServerMock && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center space-x-1">
                <Sparkles className="w-3 h-3" />
                <span>Mock Mode (Local Heuristics)</span>
              </span>
            )}
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Submit code to run senior-engineer hybrid analysis and open interactive report.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <select
            value={language}
            onChange={(e) => handleLanguageChange(e.target.value)}
            className="bg-slate-900 border border-slate-700 text-slate-200 text-sm rounded-lg px-3 py-2 focus:ring-1 focus:ring-indigo-500 focus:outline-none"
          >
            <option value="javascript">JavaScript</option>
            <option value="typescript">TypeScript</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
          </select>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-5 py-2 rounded-lg text-sm transition shadow-lg shadow-indigo-600/20 disabled:opacity-50"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Analyzing Code...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Review</span>
              </>
            )}
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center space-x-2">
          <AlertTriangle className="w-5 h-5 flex-shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Editor Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl flex flex-col h-[600px]">
        <div className="bg-slate-950 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="font-mono text-slate-300">
              snippet.
              {language === 'python'
                ? 'py'
                : language === 'java'
                ? 'java'
                : language === 'typescript'
                ? 'ts'
                : 'js'}
            </span>
          </div>
          <span>Monaco Code Editor</span>
        </div>
        <div className="flex-1">
          <Editor
            height="100%"
            theme="vs-dark"
            language={language === 'java' ? 'java' : language === 'python' ? 'python' : 'javascript'}
            value={code}
            onChange={(value) => setCode(value || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              padding: { top: 12, bottom: 12 }
            }}
          />
        </div>
      </div>
    </div>
  );
}
