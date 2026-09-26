export function DataFreshness({ state }) {
  const updated = state.fetchedAt?.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  return <p className="post-context" role="status">
    {state.refreshing ? 'Refreshing…' : state.stale || state.error ? 'Saved data · refresh needed' : 'Updates every 30 minutes'}
    {updated ? ` · Last updated ${updated} IST` : ''}
    {state.error ? ` · ${state.error}` : ''}
  </p>;
}
