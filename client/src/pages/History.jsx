import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import SeverityBadge from '../components/SeverityBadge';
import {
  History as HistoryIcon,
  PlusCircle,
  FileCode,
  Calendar,
  AlertCircle,
  ChevronRight,
  Trash2
} from 'lucide-react';

export default function History() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reviews');
      setReviews(res.data.reviews || []);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch review history.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this review?')) return;

    try {
      await api.delete(`/reviews/${id}`);
      setReviews(reviews.filter((r) => r.id !== id));
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    if (score >= 50) return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
    return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <HistoryIcon className="w-6 h-6 text-indigo-400" />
            <span>Review History</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Browse and inspect your previous automated code reviews
          </p>
        </div>

        <Link
          to="/"
          className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition shadow-lg shadow-indigo-600/20"
        >
          <PlusCircle className="w-4 h-4" />
          <span>New Review</span>
        </Link>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-900 border border-slate-800 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : reviews.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-xl space-y-3">
          <FileCode className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-semibold text-slate-200">No reviews found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            You haven't submitted any code reviews yet. Submit your first snippet to see issues and quality scores.
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Submit Code</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((rev) => (
            <Link
              key={rev.id}
              to={`/reviews/${rev.id}`}
              className="block p-4 bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 rounded-xl transition shadow-md group"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center space-x-4 min-w-0">
                  <div
                    className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center font-bold text-sm ${getScoreColor(
                      rev.score !== null ? rev.score : 100
                    )}`}
                  >
                    <span>{rev.score !== null ? rev.score : '—'}</span>
                    <span className="text-[9px] uppercase font-semibold text-slate-400">Score</span>
                  </div>

                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-800 text-indigo-400 border border-slate-700">
                        {rev.language}
                      </span>
                      <span className="text-xs text-slate-400">
                        {rev.total_issues} {rev.total_issues === 1 ? 'issue' : 'issues'} found
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 text-xs text-slate-500">
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(rev.created_at).toLocaleString()}</span>
                      </div>
                      <span>•</span>
                      <span className="capitalize">{rev.source} submission</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={(e) => handleDelete(e, rev.id)}
                    className="p-2 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition"
                    title="Delete Review"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <ChevronRight className="w-5 h-5 text-slate-600 group-hover:text-slate-300 transition" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
