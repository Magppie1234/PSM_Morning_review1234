import { useEffect, useState } from 'react';

import { API_URL } from '../lib/api.js';

export { API_URL };

export function useDashboard(filters, endpoint = '/api/dashboard', enabled = true) {
  const [state, setState] = useState({ data: null, error: '', loading: enabled, fetchedAt: null });

  useEffect(() => {
    // Inactive views keep their last result instead of querying the CRM in the background.
    if (!enabled) return undefined;
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: '' }));
    const cleanFilters = Object.fromEntries(
      Object.entries(filters ?? {}).filter(([, val]) => val !== undefined && val !== null && val !== '')
    );
    const query = new URLSearchParams(cleanFilters);
    fetch(`${API_URL}${endpoint}?${query.toString()}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Dashboard data could not be loaded.')))
      .then((data) => setState({ data, error: '', loading: false, fetchedAt: new Date() }))
      .catch((error) => { if (error.name !== 'AbortError') setState({ data: null, error: error.message, loading: false, fetchedAt: null }); });
    return () => controller.abort();
  }, [endpoint, enabled, JSON.stringify(filters)]);

  return state;
}

