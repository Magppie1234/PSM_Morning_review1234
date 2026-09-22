// How every Pre Sales component is built, for the "Show Formula" switch. Each entry lists the Zoho module,
// the filters (field display name + API name + condition) and the steps to rebuild it in Zoho CRM.
// Keep these in step with backend/src/services (leadMapper, leadFlow, contactStages, mandate).
// Module labels are Zoho's own: Leads = "Raw Leads", Contacts = "Qualified Leads", Deals = "Orders".

export const PSM_TEAM = ['Deepak', 'Ishita', 'Sowmya', 'Sparshan'];
const TEAM = PSM_TEAM.join(', ');

const LEADS = 'Raw Leads (Leads)';
const CONTACTS = 'Qualified Leads (Contacts)';
const CALLS = 'Calls';
const HISTORY = 'Lead Status History';

// A field reference: Zoho display name, API name, module.
const f = (label, api, module = LEADS) => ({ label, api, module });
const F = {
  owner: f('PSM', 'Owner'),
  created: f('Created Time', 'Created_Time'),
  status: f('Lead Status', 'Lead_Status'),
  converted: f('Is Converted', 'Converted__s'),
  source: f('Lead Source', 'Lead_Source'),
  cold: f('Reason for Cold', 'Reason_for_Cold'),
  dead: f('Dead Reason', 'Dead_Reason'),
  modified: f('Modified Time', 'Modified_Time'),
  modifiedBy: f('Modified By', 'Modified_By'),
  followDate: f('Follow Up Date', 'Next_Follow_UP_Date'),
  clientStatus: f('Client Status', 'Client_Status1'),
  bdValue: f('Value by BD(₹ Lacs)', 'Oppourtunity_Value'),
  budget: f('Client Budget In Lakhs', 'Client_Budget_In_Lakhs'),
  archName: f('Architect Name', 'Architect_Name'),
  archFirm: f('Architect Firm', 'Architect_Firm'),
  archYes: f('Working with an Architect/Interior Designer?', 'Working_with_an_Architect_Interior_Designer'),
  cPsm: f('PSM', 'Sales_Manager', CONTACTS),
  cCreated: f('Created Time', 'Created_Time', CONTACTS),
  cValue: f('Value(₹ Lacs)', 'Total_Opportunity_Value', CONTACTS),
  cStage: f('Current Stage', 'Client_Status', CONTACTS),
  cClosed: f('Actual Closure Date', 'Actual_Closure_Date', CONTACTS),
  cName: f('Full Name', 'Full_Name', CONTACTS),
  callStart: f('Call Start Time', 'Call_Start_Time', CALLS),
  callType: f('Call Type', 'Call_Type', CALLS),
  callSecs: f('Call Duration (in seconds)', 'Call_Duration_in_seconds', CALLS),
  callWhat: f('What Id (the related lead)', 'What_Id', CALLS),
  callOut: f('Outgoing Call Status', 'Outgoing_Call_Status', CALLS),
  hStatus: f('Lead Status', 'Lead_Status', HISTORY),
  hTime: f('Modified Time', 'Modified_Time', HISTORY),
  hLead: f('Full Name (the lead)', 'Full_Name', HISTORY)
};
// A filter condition on a field.
const c = (field, op, value) => ({ ...field, op, value });

const period = (ctx) => `between ${ctx.start} and ${ctx.end} (IST)`;
const teamFilter = (field = F.owner) => c(field, 'is one of', TEAM);
const NOT_CONVERTED = c(F.converted, 'is', 'false');
const CONVERTED_NOTE = 'Zoho hides converted leads from normal Raw Leads list views. To see them too, use a Raw Leads report (Is Converted = Any) or the Converted Leads view.';

const leadSteps = (ctx, extra) => [
  'Open Raw Leads in Zoho CRM.',
  `Filter: PSM is ${TEAM}.`,
  `Filter: Created Time ${period(ctx)}.`,
  ...extra
];

// Funnel cards ---------------------------------------------------------------------------------------------
export const funnelFormulas = (ctx) => ({
  raw: {
    title: 'Raw leads',
    summary: 'Every lead owned by the PSM team and created in the period, converted or not. Junk and not-interested leads are included so every lead lands in exactly one card.',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.converted, 'is', 'true or false (both)')],
    fields: [F.owner, F.created, F.converted],
    crm: leadSteps(ctx, [CONVERTED_NOTE])
  },
  contacted: {
    title: 'Contacted',
    summary: 'Raw leads minus the Not contacted card: any lead whose status has moved on from "Not Contacted Yet", plus every converted lead.',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is not', 'Not Contacted Yet  (or Is Converted = true)')],
    fields: [F.owner, F.created, F.status, F.converted],
    crm: leadSteps(ctx, ['Filter: Lead Status is not "Not Contacted Yet".', CONVERTED_NOTE])
  },
  notContacted: {
    title: 'Not contacted',
    summary: 'Leads still at "Not Contacted Yet" that were never converted. A converted lead is left out even if its status was never updated.',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is', 'Not Contacted Yet'), NOT_CONVERTED],
    fields: [F.owner, F.created, F.status, F.converted],
    crm: leadSteps(ctx, ['Filter: Lead Status is "Not Contacted Yet".'])
  },
  drawingAwaited: {
    title: 'Qualified drawing awaited',
    summary: 'Unconverted leads whose status is "Qualified/ Drawings Awiated" (Zoho\'s spelling).',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is', 'Qualified/ Drawings Awiated'), NOT_CONVERTED],
    fields: [F.owner, F.created, F.status, F.converted],
    crm: leadSteps(ctx, ['Filter: Lead Status is "Qualified/ Drawings Awiated".'])
  },
  followUp: {
    title: 'Under follow-up',
    summary: 'Unconverted, contacted leads in any status not covered by the other outcome cards: in practice Under Follow Up, Will buy in Future and Human Intervention Required(AI).',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is one of', 'Under Follow Up, Will buy in Future, Human Intervention Required(AI)'), NOT_CONVERTED],
    fields: [F.owner, F.created, F.status, F.converted],
    crm: leadSteps(ctx, ['Filter: Lead Status is Under Follow Up, Will buy in Future or Human Intervention Required(AI).'])
  },
  notResponding: {
    title: 'Not responding',
    summary: 'Unconverted leads whose status says the client is not answering: "No Response/ Call Back Later" (also "Attempted to Contact", "Not Responding" or anything with "Cold").',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is', 'No Response/ Call Back Later'), NOT_CONVERTED],
    fields: [F.owner, F.created, F.status, F.converted],
    crm: leadSteps(ctx, ['Filter: Lead Status is "No Response/ Call Back Later".'])
  },
  dropped: {
    title: 'Dropped / dead',
    summary: 'Unconverted leads marked Not Interested or Junk Lead (also Lost Lead / Not Qualified). The reason column reads Reason for Cold, or Dead Reason when that is empty.',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is one of', 'Not Interested, Junk Lead'), NOT_CONVERTED],
    fields: [F.owner, F.created, F.status, F.converted, F.cold, F.dead],
    crm: leadSteps(ctx, ['Filter: Lead Status is Not Interested or Junk Lead.', 'Add the Reason for Cold and Dead Reason columns to the view.'])
  },
  qualifiedTotal: {
    title: 'PSM qualified',
    summary: 'Qualified drawing awaited, plus leads already past it: every converted lead, and any lead with status Drawing Received or an opportunity status.',
    module: LEADS,
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.converted, 'is', 'true  — OR —  Lead Status is Qualified/ Drawings Awiated or Drawing Received')],
    fields: [F.owner, F.created, F.status, F.converted],
    crm: leadSteps(ctx, ['Filter: Lead Status is "Qualified/ Drawings Awiated" or "Drawing Received".', 'Then add the converted leads of the same PSMs and dates (Converted Leads view or a report).'])
  },
  toSm: {
    title: 'Sales qualified',
    summary: 'Qualified Leads (opportunities) created in the period whose PSM is on the team. Test records (name containing "test") are left out. Value = Σ Value(₹ Lacs). Pending validations = Current Stage empty or "Not Yet Validated" (Dead and Closed excluded).',
    module: CONTACTS,
    filters: [teamFilter(F.cPsm), c(F.cCreated, 'is', period(ctx)), c(F.cName, 'does not contain', 'test')],
    fields: [F.cPsm, F.cCreated, F.cValue, F.cStage, F.cName],
    crm: [
      'Open Qualified Leads in Zoho CRM.',
      `Filter: PSM is ${TEAM}.`,
      `Filter: Created Time ${period(ctx)}.`,
      'Sum the Value(₹ Lacs) column (a report with Sum of Value(₹ Lacs) does this). Value(₹ Lacs) is a formula field: it is empty until the Sales Person\'s Value is entered.',
      'Pending validations: add filter Current Stage is empty or "Not Yet Validated".'
    ]
  },
  closed: {
    title: 'Closed',
    summary: 'Qualified Leads whose Current Stage is Closed and whose Actual Closure Date falls in the period (not the created date).',
    module: CONTACTS,
    filters: [teamFilter(F.cPsm), c(F.cStage, 'is', 'Closed'), c(F.cClosed, 'is', period(ctx))],
    fields: [F.cPsm, F.cStage, F.cClosed, F.cValue],
    crm: ['Open Qualified Leads in Zoho CRM.', `Filter: PSM is ${TEAM}.`, 'Filter: Current Stage is Closed.', `Filter: Actual Closure Date ${period(ctx)}.`]
  }
});

export const comparisonNote = (ctx) => `Every "vs" figure applies the same rule to ${ctx.previousStart} – ${ctx.previousEnd} (${ctx.previousLabel}).`;

// Columns of the card popups ------------------------------------------------------------------------------
export const columnFormulas = {
  title: 'Popup table columns',
  summary: 'What each column in a card\'s popup is read from.',
  module: `${LEADS}, ${CALLS}, ${HISTORY}, lead Timeline`,
  rows: [
    ['Lead / Client (link)', 'Full Name, opens the record in Zoho: Raw Leads for leads, Qualified Leads for opportunities', [f('Full Name', 'Full_Name')]],
    ['Time in status', 'Now minus the latest Lead Status History entry for this lead with its current status; a lead never moved counts from Created Time. Red after 24 hours.', [F.hLead, F.hStatus, F.hTime, F.created]],
    ['Last contacted', 'Latest call whose What Id is this lead, ignoring calls scheduled for later (Outgoing Call Status "Scheduled" or subject "Call scheduled").', [F.callWhat, F.callStart, F.callType, F.callSecs, F.callOut]],
    ['Attempts', 'Number of calls with Call Type = Outbound on this lead, out of the 15 allowed.', [F.callWhat, F.callType]],
    ['Created', 'Created Time in IST; tagged After hours when outside 9:30 am – 6:30 pm.', [F.created]],
    ['Modified', 'Modified Time, current Lead Status and Modified By.', [F.modified, F.status, F.modifiedBy]],
    ['Reassigned to (by)', 'Latest change of the PSM field in the lead\'s Timeline (Zoho audit log): new owner, who changed it and when.', [f('Timeline · field history of PSM', 'Owner (via /Leads/{id}/__timeline)')]],
    ['Reason for dropping', 'Reason for Cold, or Dead Reason when that is empty.', [F.cold, F.dead]],
    ['Validation (opportunities)', 'Current Stage; empty means not yet validated.', [F.cStage]]
  ]
};

// Mandate bar ---------------------------------------------------------------------------------------------
export const mandateFormula = (ctx, mandate) => {
  const targets = (mandate?.byPsm ?? []).map((row) => `${row.name} ₹${(row.monthly ?? 0) / 1e7} Cr`).join(', ');
  return {
    title: 'PSM Mandate Progress',
    summary: 'Achieved = Σ Value(₹ Lacs) of Qualified Leads created in the period under a team PSM. Target = each PSM\'s written monthly target; Daily, Weekly and Custom use the month\'s target × days covered ÷ days in the month. Needed per working day = (target − achieved) ÷ working days left this month after today, Sundays excluded.',
    module: CONTACTS,
    filters: [teamFilter(F.cPsm), c(F.cCreated, 'is', period(ctx)), c(F.cName, 'does not contain', 'test')],
    fields: [F.cPsm, F.cCreated, F.cValue, f('BD Value', 'Amount', CONTACTS), f("Sales Person's Value", 'Sales_Person_s_Value', CONTACTS)],
    notes: [
      `Monthly targets (not in Zoho; set in backend/src/config/psmTargets.js): ${targets || 'none for this month'}.`,
      '"No value in Zoho" counts opportunities whose Value(₹ Lacs) is empty — it fills only after the Sales Person\'s Value is entered, so achievement is understated until then. BD Value (the PSM\'s own value) is filled on every record but is not used here.'
    ],
    crm: [
      'Open Qualified Leads in Zoho CRM.',
      `Filter: PSM is ${TEAM}.`,
      `Filter: Created Time ${period(ctx)}.`,
      'Report with Sum of Value(₹ Lacs), grouped by PSM, gives the achieved amounts.'
    ]
  };
};

// Needs action today --------------------------------------------------------------------------------------
export const riskFormulas = (ctx) => ({
  'Missed leads': {
    summary: 'Same as the Not contacted card, minus Junk / Not Interested: status "Not Contacted Yet" and never converted.',
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'is', 'Not Contacted Yet'), NOT_CONVERTED]
  },
  'Overdue follow-ups': {
    summary: 'Status contains "Follow Up" and Follow Up Date is before today. Note: PSMs fill Follow Up Date/Time (Follow_Up_Date_Time) instead, so this field is empty and the card shows none.',
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.status, 'contains', 'Follow Up'), c(F.followDate, 'is before', 'today')]
  },
  'Hot leads pending': {
    summary: 'Client Status is Hot, the lead is not qualified, not converted, and not Junk / Not Interested.',
    filters: [teamFilter(), c(F.created, 'is', period(ctx)), c(F.clientStatus, 'is', 'Hot'), c(F.status, 'is not', 'Qualified…, Drawing Received, Junk Lead, Not Interested'), NOT_CONVERTED]
  },
  'Qualified 7+ days': {
    summary: 'Status starts "Qualified/" or is Drawing Received, and the lead was created 7 or more days ago.',
    filters: [teamFilter(), c(F.status, 'starts with', 'Qualified/  (or is Drawing Received)'), c(F.created, 'is', `${period(ctx)} and 7+ days before today`)]
  },
  'Drawings delayed': {
    summary: 'Status "Qualified/ Drawings Awiated" and the lead was created 7 or more days ago.',
    filters: [teamFilter(), c(F.status, 'is', 'Qualified/ Drawings Awiated'), c(F.created, 'is', `${period(ctx)} and 7+ days before today`)]
  }
});

// PSM performance table ------------------------------------------------------------------------------------
export const teamFormula = {
  title: 'PSM performance',
  summary: 'One row per team PSM (always all four), from their Raw Leads created in the period, excluding Junk Lead and Not Interested.',
  module: LEADS,
  rows: [
    ['Leads', 'Leads owned by the PSM, created in the period, status not Junk Lead / Not Interested.', [F.owner, F.created, F.status]],
    ['Lead arrival', '9:30–6:30 = Created Time between 9:30 am and 6:30 pm IST; After hours = the rest.', [F.created]],
    ['Contacted', 'Leads minus status "Not Contacted Yet" (converted leads count as contacted).', [F.status, F.converted]],
    ['Qualified', 'Status starts "Qualified/" or is Drawing Received.', [F.status]],
    ['Architect', 'Lead Source contains architect / designer, or Architect Name / Firm filled, or "Working with an Architect" = Yes.', [F.source, F.archName, F.archFirm, F.archYes]],
    ['Client reach', 'Lead Source is a client-first source: Website, WhatsApp, Instagram chatbot / Direct Instagram / Chat, IVR, Walk In / Store Walk-In, Scanner, Repeat.', [F.source]],
    ['Value', 'Σ Value by BD(₹ Lacs), or Client Budget In Lakhs when that is empty.', [F.bdValue, F.budget]],
    ['Missed', 'Status "Not Contacted Yet" and not converted.', [F.status, F.converted]],
    ['Status', 'Watch when Missed > 0, else On track; No leads when the PSM has none (hover a 0 for the reason).', []]
  ]
};

export const queueFormula = {
  title: 'Senior decision queue',
  summary: 'Leads needing a decision, grouped by issue: Missed (not contacted), Hot pending, Overdue follow-up, and Drawings delayed (Qualified/ Drawings Awiated, 7+ days old). A lead appears once, first issue wins; the list is capped at 20.',
  module: LEADS,
  filters: [teamFilter(), c(F.status, 'is one of', 'Not Contacted Yet, Qualified/ Drawings Awiated'), c(F.clientStatus, 'or is', 'Hot')]
};

export const rotaFormula = {
  title: 'Monday roster',
  summary: 'Not from Zoho. Pairs alternate every Monday from 21 Sept 2026: Deepak + Sparshan work, then Ishita + Sowmya. Set in MondayRoster.jsx and backend/src/config/roster.js.'
};

export const conversionFormula = {
  title: 'Lead conversion funnel (bottom of page)',
  summary: 'Step-by-step conversion of the team\'s leads created in the period, excluding Junk Lead and Not Interested. Each step\'s % is against the step named beside it.',
  module: `${LEADS}; Booked also reads Orders (Deals)`,
  rows: [
    ['Total leads', 'Leads owned by a team PSM, created in the period, status not Junk Lead / Not Interested.', [F.owner, F.created, F.status]],
    ['Contacted', 'Total minus status "Not Contacted Yet" (converted leads count as contacted).', [F.status, F.converted]],
    ['Qualified', 'Status starts "Qualified/" or is Drawing Received.', [F.status]],
    ['Enabled', 'Is Converted = true (turned into an opportunity).', [F.converted]],
    ['Drawing Received', 'Status is Drawing Received.', [F.status]],
    ['Booked', 'Converted, and the converted Order\'s Stage is Order Booked or Closed Won.', [F.converted, f('Converted Deal', 'Converted_Deal'), f('Stage', 'Stage', 'Orders (Deals)')]]
  ]
};
