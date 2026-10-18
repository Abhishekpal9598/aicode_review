import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/common/EmptyState';
import { Button } from '../components/ui/Button';
import { FileQuestion, Home } from 'lucide-react';

export function NotFound() {
  return (
    <div className="py-12">
      <EmptyState
        icon={FileQuestion}
        title="404 — Page Not Found"
        description="The workstation route you requested does not exist or has been relocated."
        action={
          <Link to="/dashboard">
            <Button variant="primary" size="md" icon={Home}>
              Return to Dashboard
            </Button>
          </Link>
        }
      />
    </div>
  );
}

export default NotFound;
