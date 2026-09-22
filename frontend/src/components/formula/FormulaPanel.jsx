import { FunctionSquare } from 'lucide-react';
import { createContext, useContext, useState } from 'react';

// "Show Formula" switch: when on, each component renders a panel explaining exactly how it is built.
const FormulaContext = createContext(false);
export const useShowFormula = () => useContext(FormulaContext);
export const FormulaProvider = FormulaContext.Provider;

const STORAGE_KEY = 'ps-show-formula';
export function useFormulaSwitch() {
  const [on, setOn] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const toggle = () => setOn((current) => {
    try { localStorage.setItem(STORAGE_KEY, current ? '0' : '1'); } catch { /* storage unavailable */ }
    return !current;
  });
  return [on, toggle];
}

export function FormulaButton({ on, onToggle }) {
  return (
    <button type="button" className="fx-toggle" aria-pressed={on} onClick={onToggle} title="Show how every component is calculated from Zoho CRM">
      <FunctionSquare size={14} aria-hidden="true" />
      {on ? 'Hide Formula' : 'Show Formula'}
    </button>
  );
}

function FieldTag({ field }) {
  return (
    <span className="fx-field" title={field.module}>
      {field.label} <code>{field.api}</code>
    </span>
  );
}

// One formula: summary, module, filters, fields and the steps to rebuild it in Zoho CRM.
export function Formula({ entry, compact = false }) {
  if (!entry) return null;
  const fields = entry.fields ?? [];
  return (
    <div className={`fx-card${compact ? ' compact' : ''}`}>
      {entry.title && <h4>{entry.title}</h4>}
      <p className="fx-summary">{entry.summary}</p>
      {entry.module && <p className="fx-line"><b>Module</b> {entry.module}</p>}
      {entry.filters?.length > 0 && (
        <div className="fx-block">
          <b>Filters</b>
          <ul>
            {entry.filters.map((filter, index) => (
              <li key={index}><FieldTag field={filter} /> <em>{filter.op}</em> {filter.value}</li>
            ))}
          </ul>
        </div>
      )}
      {fields.length > 0 && (
        <div className="fx-block">
          <b>Fields</b>
          <div className="fx-fields">{fields.map((field) => <FieldTag field={field} key={`${field.module}${field.api}`} />)}</div>
        </div>
      )}
      {entry.rows && (
        <table className="fx-table">
          <thead><tr><th scope="col">Column</th><th scope="col">How it is worked out</th><th scope="col">Fields (display name · API name)</th></tr></thead>
          <tbody>
            {entry.rows.map(([name, how, rowFields]) => (
              <tr key={name}><th scope="row">{name}</th><td>{how}</td><td>{rowFields.map((field) => <FieldTag field={field} key={field.api} />)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {entry.notes?.map((note) => <p className="fx-note" key={note}>{note}</p>)}
      {entry.crm?.length > 0 && (
        <div className="fx-block">
          <b>Rebuild it in Zoho CRM</b>
          <ol>{entry.crm.map((step) => <li key={step}>{step}</li>)}</ol>
        </div>
      )}
    </div>
  );
}

// A titled group of formulas, shown only while the switch is on.
export function FormulaPanel({ title, children }) {
  const on = useShowFormula();
  if (!on) return null;
  return (
    <section className="fx-panel" aria-label={`${title} formula`}>
      <header><FunctionSquare size={15} aria-hidden="true" /> {title} · formula</header>
      {children}
    </section>
  );
}
