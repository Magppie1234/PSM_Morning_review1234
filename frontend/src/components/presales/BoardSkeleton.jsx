export function BoardSkeleton() {
  return (
    <div className="ps ps-skeleton" aria-busy="true">
      <span className="sr-only" role="status">Loading dashboard metrics…</span>
      <div className="ps-head" aria-hidden="true">
        <div>
          <span className="ps-bone" style={{ width: 260, height: 30 }} />
          <span className="ps-bone" style={{ width: 380, height: 14, marginTop: 10 }} />
        </div>
        <span className="ps-bone" style={{ width: 320, height: 36 }} />
      </div>
      <div className="ps-bone ps-bone-block" style={{ height: 116 }} aria-hidden="true" />
      <div className="ps-bone ps-bone-block" style={{ height: 88 }} aria-hidden="true" />
      <div className="ps-split" aria-hidden="true">
        <div className="ps-bone ps-bone-block" style={{ height: 320 }} />
        <div className="ps-bone ps-bone-block" style={{ height: 320 }} />
      </div>
    </div>
  );
}
