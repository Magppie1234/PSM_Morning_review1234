import { useCallback, useEffect, useRef, useState } from 'react';

import { API_URL } from '../lib/api.js';

export { API_URL };

export function useDashboard(filters, endpoint = '/api/dashboard', enabled = true) {
  const [state, setState] = useState({ data: null, error: '', loading: enabled, fetchedAt: null });
  // Bumped by refresh(). Only that one request asks the API to read the CRM again instead of its cached
  // copy; a later change of period or person is served from the cache as before.
  const [reload, setReload] = useState(0);
  const skipCache = useRef(false);

  useEffect(() => {
    // Inactive views keep their last result instead of querying the CRM in the background.
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    const cleanFilters = Object.fromEntries(
      Object.entries(filters ?? {}).filter(([, val]) => val !== undefined && val !== null && val !== '')
    );
    const fresh = skipCache.current;
    skipCache.current = false;
    const query = new URLSearchParams(fresh ? { ...cleanFilters, refresh: '1' } : cleanFilters);
    fetch(`${API_URL}${endpoint}?${query.toString()}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dashboard data could not be loaded.')))
      .then((data) => setState({ data, error: '', loading: false, fetchedAt: new Date() }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ data: null, error: error.message, loading: false, fetchedAt: null }); });
    return () => controller.abort();
  }, [endpoint, enabled, reload, JSON.stringify(filters)]);

  const refresh = useCallback(() => {
    skipCache.current = true;
    setReload((count) => count + 1);
  }, []);

  return { ...state, refresh };
}

