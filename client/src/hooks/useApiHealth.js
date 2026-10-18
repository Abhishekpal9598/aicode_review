import { useState, useEffect, useCallback } from 'react';
import apiClient from '../services/apiClient';

/**
 * Custom hook for live backend health monitoring.
 * Provides states: 'checking', 'online', 'unavailable'
 * Supports manual re-check and 30-second background polling.
 */
export function useApiHealth(pollIntervalMs = 30000) {
  const [status, setStatus] = useState('checking'); // 'checking' | 'online' | 'unavailable'
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [lastChecked, setLastChecked] = useState(null);

  const checkHealth = useCallback(async () => {
    setStatus((prev) => (prev === 'online' ? 'online' : 'checking'));
    setError(null);
    try {
      const res = await apiClient.checkHealth();
      if (res && res.success && res.status === 'healthy') {
        setStatus('online');
        setData(res);
      } else {
        setStatus('unavailable');
        setError(res?.message || 'Degraded API status');
      }
    } catch (err) {
      setStatus('unavailable');
      setError(err.message || 'API is unreachable');
      setData(null);
    } finally {
      setLastChecked(new Date());
    }
  }, []);

  useEffect(() => {
    checkHealth();

    if (pollIntervalMs > 0) {
      const interval = setInterval(checkHealth, pollIntervalMs);
      return () => clearInterval(interval);
    }
  }, [checkHealth, pollIntervalMs]);

  return {
    status,
    data,
    error,
    lastChecked,
    retry: checkHealth
  };
}

export default useApiHealth;
