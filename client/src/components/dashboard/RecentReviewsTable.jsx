import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardHeader } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { EmptyState } from '../common/EmptyState';
import { FileCode2, ArrowRight, Clock } from 'lucide-react';

const statusVariants = {
  completed: 'emerald',
  analyzing: 'indigo',
  pending: 'amber',
  failed: 'rose'
};

export function RecentReviewsTable({ recentReviews = [] }) {
  const hasReviews = Array.isArray(recentReviews) && recentReviews.length > 0;

  return (
    <Card className="p-5 bg-surface-secondary/60 border-border-subtle flex flex-col justify-between">
      <div className="flex items-center justify-between gap-2 mb-4">
        <CardHeader
          title="Recent Review Activity"
          subtitle="Latest code review submissions in your workspace"
        />
        <Badge variant={hasReviews ? 'emerald' : 'slate'} size="xs" mono>
          {hasReviews ? `${recentReviews.length} Submissions` : 'Zero Recorded'}
        </Badge>
      </div>

      {hasReviews ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border-subtle text-text-muted font-mono uppercase tracking-wider">
                <th className="py-2.5 px-3">Title</th>
                <th className="py-2.5 px-3">Language</th>
                <th className="py-2.5 px-3">Lines of Code</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3">Date Submitted</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle/50 font-mono">
              {recentReviews.map((review) => {
                const dateStr = review.createdAt
                  ? new Date(review.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric'
                    })
                  : 'N/A';

                return (
                  <tr key={review._id || review.title} className="hover:bg-surface-primary/40 transition-colors">
                    <td className="py-2.5 px-3 font-medium text-text-primary truncate max-w-[180px]">
                      {review.title}
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant="indigo" size="xs" mono>
                        {review.language}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-text-secondary">
                      {review.lineCount} LOC
                    </td>
                    <td className="py-2.5 px-3">
                      <Badge variant={statusVariants[review.status] || 'slate'} size="xs" mono>
                        {review.status || 'pending'}
                      </Badge>
                    </td>
                    <td className="py-2.5 px-3 text-text-muted flex items-center gap-1.5">
                      <Clock className="w-3 h-3 text-text-muted" />
                      <span>{dateStr}</span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      {/* Action is a UI-only navigation control linking to /code-review, not a database field */}
                      <Link
                        to="/code-review"
                        className="inline-flex items-center gap-1 text-xs text-brand-primary hover:text-brand-primary/80 transition-colors font-medium font-sans"
                      >
                        <span>Open Workspace</span>
                        <ArrowRight className="w-3 h-3" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState
          icon={FileCode2}
          title="No Code Reviews Recorded Yet"
          description="Your developer workspace is ready. Launch the Review Workspace to explore code input options."
          action={
            <Link to="/code-review">
              <Button variant="primary" size="sm" className="gap-2 font-mono text-xs">
                <span>Launch Review Workspace</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          }
        />
      )}
    </Card>
  );
}

export default RecentReviewsTable;
