import { PreSalesFunnel } from './presales/PreSalesFunnel.jsx';

// Legacy entry point used by the Design and PDI dashboards; renders the shared light chevron funnel.
export function Funnel({ stages = [], reportLabel = '', onSelect, title = 'Conversion Funnel' }) {
  return (
    <PreSalesFunnel
      stages={stages}
      periodName={reportLabel}
      onOpen={onSelect}
      title={title}
      detailLabel={`${title} details`}
    />
  );
}
