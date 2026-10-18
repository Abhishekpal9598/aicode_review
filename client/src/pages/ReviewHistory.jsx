import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '../components/common/PageHeader';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/common/EmptyState';
import {
  History,
  Search,
  Filter,
  FileCode2,
  Trash2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  X,
  Clock,
  RefreshCw,
  AlertCircle,
  ShieldAlert
} from 'lucide-react';
import apiClient from '../services/apiClient';

const GRADE_COLORS = {
  A: 'text-emerald-400 border-emerald-500/40 bg-emerald-500/10',
  B: 'text-blue-400 border-blue-500/40 bg-blue-500/10',
  C: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10',
  D: 'text-amber-400 border-amber-500/40 bg-amber-500/10',
  F: 'text-rose-400 border-rose-500/40 bg-rose-500/10'
};

const statusVariants = {
  completed: 'emerald',
  analyzing: 'indigo',
  pending: 'amber',
  failed: 'rose'
};

export function ReviewHistory() {
  const navigate = useNavigate();

  const [reviews, setReviews] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter state
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Deletion state
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  // Fetch reviews from API
  const fetchReviews = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params = {
        page: currentPage,
        limit: pagination.limit
      };

      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }
      if (languageFilter !== 'ALL') {
        params.language = languageFilter;
      }
      if (statusFilter !== 'ALL') {
        params.status = statusFilter;
      }

      const res = await apiClient.getReviews(params);

      if (res && res.success) {
        setReviews(res.data || []);
        if (res.meta?.pagination) {
          setPagination(res.meta.pagination);
        }
      } else {
        throw new Error(res?.message || 'Failed to retrieve reviews');
      }
    } catch (err) {
      console.error('[ReviewHistory] Fetch error:', err);
      setError(err.message || 'Failed to load reviews. Please verify server connection.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, pagination.limit, searchQuery, languageFilter, statusFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  // Handle search submit / enter key
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setCurrentPage(1);
    setSearchQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1);
  };

  // Handle review deletion confirmation
  const handleConfirmDelete = async () => {
    if (!reviewToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const res = await apiClient.deleteReview(reviewToDelete._id);
      if (res && res.success) {
        setReviewToDelete(null);
        // If this was the last item on the page and we're not on page 1, go to previous page
        if (reviews.length === 1 && currentPage > 1) {
          setCurrentPage((prev) => prev - 1);
        } else {
          fetchReviews();
        }
      } else {
        throw new Error(res?.message || 'Failed to delete review');
      }
    } catch (err) {
      console.error('[ReviewHistory] Delete error:', err);
      setDeleteError(err.message || 'Failed to delete review');
    } finally {
      setIsDeleting(false);
    }
  };

  // Open review deep-link in workspace
  const handleOpenWorkspace = (reviewId) => {
    navigate(`/code-review?reviewId=${reviewId}`);
  };

  return (
    <div className="space-y-6" data-testid="review-history-page">
      <PageHeader
        title="Review History & Archives"
        description="Persistent audit log of previous code reviews, quality score histories, and categorized issue resolutions."
        icon={History}
        badgeText="Persistent Audit Trail"
        badgeVariant="indigo"
      />

      {/* Global Error Banner */}
      {(error || deleteError) && (
        <div
          role="alert"
          className="flex items-center justify-between p-3.5 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs"
        >
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error || deleteError}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              setError(null);
              setDeleteError(null);
            }}
            className="p-1 rounded hover:bg-rose-500/20 text-rose-400"
            aria-label="Dismiss error"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <Card className="p-4 bg-surface-secondary/70 border-border-subtle">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search by title or filename..."
              data-testid="search-input"
              className="w-full bg-surface-primary border border-border-subtle rounded-md pl-9 pr-8 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Filters: Language & Status */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-text-secondary">
              <Filter className="w-3.5 h-3.5 text-text-muted shrink-0" />
              <span className="hidden sm:inline">Filters:</span>
            </div>

            {/* Language Filter */}
            <select
              value={languageFilter}
              onChange={(e) => {
                setLanguageFilter(e.target.value);
                setCurrentPage(1);
              }}
              data-testid="language-filter"
              className="bg-surface-primary border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer"
            >
              <option value="ALL">All Languages</option>
              <option value="python">Python</option>
              <option value="javascript">JavaScript</option>
              <option value="typescript">TypeScript</option>
              <option value="java">Java</option>
              <option value="c">C</option>
              <option value="cpp">C++</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              data-testid="status-filter"
              className="bg-surface-primary border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary focus:outline-none focus:border-brand-primary cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="completed">Completed</option>
              <option value="failed">Failed</option>
            </select>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={fetchReviews}
              className="p-1.5 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              title="Refresh reviews"
              aria-label="Refresh reviews"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* Main Reviews Table / List Container */}
      <Card className="p-0 bg-surface-secondary/60 border-border-subtle overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center flex flex-col items-center justify-center">
            <div className="w-8 h-8 border-2 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin mb-3" />
            <span className="text-xs text-text-secondary">Loading review history...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="p-8">
            <EmptyState
              icon={FileCode2}
              title={
                searchQuery || languageFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'No Reviews Match Your Filter'
                  : 'No Code Reviews Recorded Yet'
              }
              description={
                searchQuery || languageFilter !== 'ALL' || statusFilter !== 'ALL'
                  ? 'Try clearing your search query or adjusting your filters to find existing code reviews.'
                  : 'Submit a code review from the Code Review Workspace to start tracking your quality trends and security audit history.'
              }
              action={
                searchQuery || languageFilter !== 'ALL' || statusFilter !== 'ALL' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput('');
                      setSearchQuery('');
                      setLanguageFilter('ALL');
                      setStatusFilter('ALL');
                      setCurrentPage(1);
                    }}
                    className="px-3 py-1.5 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs text-brand-primary font-medium cursor-pointer"
                  >
                    Reset All Filters
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => navigate('/code-review')}
                    className="px-3 py-1.5 rounded bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold cursor-pointer shadow-sm shadow-brand-primary/20"
                  >
                    Launch Review Workspace
                  </button>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-border-subtle bg-surface-primary/70 text-text-muted font-mono uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Review Title & File</th>
                  <th className="py-3 px-3">Language</th>
                  <th className="py-3 px-3">LOC</th>
                  <th className="py-3 px-3">Grade & Score</th>
                  <th className="py-3 px-3">Mode</th>
                  <th className="py-3 px-3">Date Submitted</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle/50 font-mono">
                {reviews.map((review) => {
                  const dateStr = review.createdAt
                    ? new Date(review.createdAt).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      })
                    : 'N/A';

                  const grade = review.grade || 'A';
                  const gradeBadgeStyle = GRADE_COLORS[grade] || GRADE_COLORS.C;
                  const score = review.overallScore ?? review.staticScore ?? 100;
                  const isHybrid = review.reviewMode === 'hybrid';

                  return (
                    <tr
                      key={review._id}
                      data-testid={`review-row-${review._id}`}
                      className="hover:bg-surface-primary/40 transition-colors"
                    >
                      {/* Title & File */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-text-primary text-xs truncate max-w-[220px]">
                            {review.title}
                          </span>
                          <span className="text-[10px] text-text-muted font-mono truncate max-w-[220px]">
                            {review.filename || 'snippet'}
                          </span>
                        </div>
                      </td>

                      {/* Language */}
                      <td className="py-3 px-3">
                        <Badge variant="indigo" size="xs" mono>
                          {review.language}
                        </Badge>
                      </td>

                      {/* LOC */}
                      <td className="py-3 px-3 text-text-secondary">
                        {review.lineCount} LOC
                      </td>

                      {/* Grade & Score */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`w-6 h-6 rounded border flex items-center justify-center font-bold text-xs ${gradeBadgeStyle}`}
                            title={`Grade: ${grade}`}
                          >
                            {grade}
                          </span>
                          <span className="text-text-primary font-medium text-xs">
                            {score}%
                          </span>
                        </div>
                      </td>

                      {/* Review Mode Badge */}
                      <td className="py-3 px-3">
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border uppercase ${
                            isHybrid
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}
                        >
                          {isHybrid ? 'Hybrid' : 'Fallback'}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3 px-3 text-text-muted">
                        <div className="flex items-center gap-1.5 font-sans text-xs">
                          <Clock className="w-3.5 h-3.5 text-text-muted shrink-0" />
                          <span>{dateStr}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-2 font-sans">
                          <button
                            type="button"
                            onClick={() => handleOpenWorkspace(review._id)}
                            data-testid={`open-workspace-${review._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-primary hover:bg-surface-tertiary border border-border-subtle text-xs text-brand-primary font-medium transition-colors cursor-pointer"
                            title="Open review in workspace"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() => navigate(`/security?reviewId=${review._id}`)}
                            data-testid={`view-security-${review._id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-primary hover:bg-rose-500/10 border border-border-subtle hover:border-rose-500/30 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors cursor-pointer"
                            title="View Security Dashboard for this review"
                          >
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            <span>Security</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setReviewToDelete(review)}
                            data-testid={`delete-review-${review._id}`}
                            className="p-1 rounded bg-surface-primary hover:bg-rose-500/10 border border-border-subtle hover:border-rose-500/30 text-text-muted hover:text-rose-400 transition-colors cursor-pointer"
                            title="Delete review"
                            aria-label={`Delete review ${review.title}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {reviews.length > 0 && (
          <div className="p-3 border-t border-border-subtle bg-surface-primary/60 flex items-center justify-between text-xs text-text-secondary">
            <span>
              Showing Page <strong className="text-text-primary">{pagination.page}</strong> of{' '}
              <strong className="text-text-primary">{pagination.pages}</strong> ({pagination.total} total reviews)
            </span>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1 || isLoading}
                data-testid="pagination-prev"
                className={`p-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
                  currentPage <= 1 || isLoading
                    ? 'border-border-subtle/50 text-text-muted cursor-not-allowed opacity-50'
                    : 'border-border-subtle hover:bg-surface-tertiary text-text-primary cursor-pointer'
                }`}
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">Prev</span>
              </button>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={currentPage >= pagination.pages || isLoading}
                data-testid="pagination-next"
                className={`p-1.5 rounded border text-xs flex items-center gap-1 transition-colors ${
                  currentPage >= pagination.pages || isLoading
                    ? 'border-border-subtle/50 text-text-muted cursor-not-allowed opacity-50'
                    : 'border-border-subtle hover:bg-surface-tertiary text-text-primary cursor-pointer'
                }`}
                aria-label="Next page"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      {reviewToDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-canvas/80 backdrop-blur-sm animate-in fade-in-50 duration-150"
        >
          <div className="bg-surface-secondary border border-border-subtle rounded-lg max-w-sm w-full p-4 shadow-modal">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded bg-rose-500/10 text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <h3 id="delete-dialog-title" className="text-sm font-semibold text-text-primary">
                  Delete Code Review?
                </h3>
                <p className="text-xs text-text-secondary mt-1 leading-relaxed">
                  Are you sure you want to delete <strong className="text-text-primary">{reviewToDelete.title}</strong>? This will permanently remove the review, analysis metrics, and all associated issues.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewToDelete(null)}
                className="text-text-muted hover:text-text-primary"
                aria-label="Close dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-border-subtle/60">
              <button
                type="button"
                onClick={() => setReviewToDelete(null)}
                disabled={isDeleting}
                className="px-3 py-1.5 rounded text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                data-testid="confirm-delete-button"
                className="px-3 py-1.5 rounded text-xs font-semibold bg-rose-500 hover:bg-rose-600 text-white transition-colors cursor-pointer shadow-sm shadow-rose-500/20 flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Delete Review</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ReviewHistory;
