// Zoho CRM web address for "open this record" links: https://crm.zoho.in/crm/org<ORG_ID>.
export const CRM_URL = (import.meta.env.VITE_ZOHO_CRM_URL ?? 'https://crm.zoho.in/crm/org60046349006').replace(/\/$/, '');

// Zoho module API names: Leads show as "Raw Leads" and Contacts as "Qualified Leads" in the CRM.
export const crmRecordUrl = (module, id) => `${CRM_URL}/tab/${module}/${id}`;
