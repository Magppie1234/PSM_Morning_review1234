import { RefreshCw } from 'lucide-react';
// Manual refresh bypasses the current dashboard's 30-minute data cache.
export function RefreshButton({ onRefresh, loading }) {
  return (
    <button
      type="button"
      className={`ps-refresh${loading ? ' is-busy' : ''}`}
      onClick={onRefresh}
      disabled={loading}
      title="Fetch the latest records from Zoho CRM"
    >
      <RefreshCw size={14} aria-hidden="true" />
      {loading ? 'Refreshing' : 'Refresh'}
    </button>
  );
}


