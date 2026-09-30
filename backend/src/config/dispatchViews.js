// THE DISPATCH BOARD'S FOUR VIEWS — Planner, Scheduler, Tracker, Complaints.
//
// Ported from the mockup served at :5520, card for card and label for label. What changed in the
// port is only the SOURCE: the mockup ran on 110 generated orders and 120 generated tickets, and
// every figure here comes from Zoho instead.
//
// ---------------------------------------------------------------------------
// WHAT ZOHO CAN AND CANNOT ANSWER — checked against all 7,618 orders
// ---------------------------------------------------------------------------
// The same problem as the post-design board: Zoho models this workflow with dedicated milestone
// fields and nobody fills them. Measured fill rates:
//
//   MRP_No                      2,172  (29%)   usable
//   Dispatch_Date               1,850  (24%)   usable — the one real dispatch date
//   Designer_Name               3,231  (42%)   usable
//   Value                       5,173  (68%)   usable
//   Installation_Managers         276   (4%)   thin
//   Actual_installation_start_date 139  (2%)   thin
//   Est_PDI_Date / Expected_PDI_date / Aligned_PDI_date      0   EMPTY
//   Handover_to_Factory / Est_Dispatch_Factory_Date          0   EMPTY
//   Ready_For_Dispatch_* / Dispatch_* / Installation_*       0   EMPTY
//   PDI_Done / PDI_Status / Production_Drawing_Status        0-1 EMPTY
//
// So the cards are built from Deals.Stage and the dated DealHistory ledger, exactly as the
// post-design board is, with Dispatch_Date and MRP_No used where they are real.
//
// Four cards in the mockup have NO source in Zoho at all. They are kept — the customer asked for
// this board card for card — but each carries `available: false` and the reason, so an empty card
// reads as "the CRM does not record this" and never as "nothing happened". They are:
//
//   Tracker   · Vehicle held          no vehicle-hold field or stage exists
//   Planner   · Overdue orders        needs Est_PDI_Date, which is empty on every order
//   Scheduler · Installation approved no installation-approval field; the stage is a weak proxy
//   Complaints· department / hop SLA  routing between Design, Factory, Installation and Services
//                                     is not modelled anywhere in the CRM
//
// ---------------------------------------------------------------------------
// The stage ladder these views cut
// ---------------------------------------------------------------------------
// Orders sitting at a production, dispatch or installation stage today: about 240 across the whole
// module, so these cards are small by nature. The flow figures (entered during the period) are the
// larger and more useful of the two, as on post-design.

// Production has been approved and set up, but the line has not started.
export const READY_FOR_PRODUCTION = [
  'Create MPP', 'Create Production Set', 'Material Procurement', 'Precourement'
];
export const IN_PRODUCTION = ['Start Production'];
// Made, and waiting to leave the factory.
export const READY_FOR_DISPATCH = [
  'Site Approved for Dispatch', 'Handover to Factory', 'Send PDI Drawings to Factory'
];
// Left the factory. The CRM spells it "Dipatch" on one value.
export const DISPATCHED = [
  'First Dipatch Done', 'Full Dispatch', 'Split Dispatch',
  'Sent for Second Dispatch Approval', 'Second Dispatch Approved', 'Second Dispatch Done'
];
export const DELIVERED = ['Handover to Installation Team', 'Start First Installation Process', 'Start Second Installation Process'];
export const INSTALLED = ['First Installation Done', 'Second Installation Done', 'Final Handover', 'Complete'];

export const PRODUCTION_SIGNOFF = ['Prep. of Sign-off & Production Drawing', 'Design Approval', 'Sent for Design Approval', 'Verification'];
export const PDI_APPROVED = ['PDI Done', 'PDI Verifiction'];
export const PDI_ANY = ['Prepare PDI', 'Align PDI', 'Request Visit for PDI', 'PDI', ...PDI_APPROVED];
export const FINANCE_APPROVED = ['PDI Payment Done', 'Payment Approvals', 'Approval from Accounts'];
export const FINANCE_PENDING = ['Sent for PDI payment Approval', 'Payment Awaited'];

// ---------------------------------------------------------------------------
// The cards, in the mockup's own order and with its own labels and sub-lines
// ---------------------------------------------------------------------------
// `tone` follows the mockup's colours. `stages` is what the card counts; a card with no `stages`
// and `available: false` is one the CRM cannot answer.
export const DISPATCH_VIEWS = [
  {
    key: 'planner',
    name: 'Dispatch Planner',
    desc: 'Total orders → production sign-off → assigned or unassigned → PDI approved. Click a card to see its orders.',
    // The funnel's columns. A column holding more than one key is a BRANCH: the cards stack and a
    // bracket rail joins them, exactly as the Pre Sales funnel draws its outcomes.
    columns: [['total'], ['signoff'], ['overdue', 'assigned', 'unassigned'], ['pdi']],
    cards: [
      { key: 'total', label: 'Total orders', tone: 'ink', sub: 'Every booked order', all: true },
      { key: 'signoff', label: 'Production sign-off', tone: 'teal', sub: 'Production sign-off done', stages: PRODUCTION_SIGNOFF },
      {
        key: 'overdue',
        label: 'Overdue orders',
        tone: 'red',
        sub: 'PDI due passed, PDI not approved',
        noWins: true,
        available: false,
        why: 'Needs Est. PDI Date, which is empty on all 7,618 orders in Zoho.'
      },
      { key: 'assigned', label: 'Assigned orders', tone: 'blue', sub: 'Dispatch date set', field: 'dispatchOn' },
      { key: 'unassigned', label: 'Unassigned orders', tone: 'amber', sub: 'No dispatch date yet', field: '!dispatchOn' },
      { key: 'pdi', label: 'PDI approved', tone: 'green', sub: 'Passed PDI · moves to the Scheduler', stages: PDI_APPROVED }
    ]
  },
  {
    key: 'scheduler',
    name: 'Dispatch Scheduler',
    desc: 'PDI-approved orders carried over from the Planner, waiting on finance and installation before production.',
    columns: [['pdi'], ['fin', 'ins'], ['both']],
    cards: [
      { key: 'pdi', label: 'PDI approved', tone: 'green', sub: 'Carried over from the Planner · PDI approved, not dispatched', stages: PDI_APPROVED },
      { key: 'fin', label: 'Finance approved', tone: 'blue', sub: 'Finance OK · installation pending', stages: FINANCE_APPROVED },
      {
        key: 'ins',
        label: 'Installation approved',
        tone: 'teal',
        sub: 'Installation OK · finance pending',
        available: false,
        why: 'Zoho has no installation-approval field. Installation Managers is filled on 4% of orders, which is too thin to count on.'
      },
      { key: 'both', label: 'Approved for production', tone: 'violet', sub: 'Approved and released to the Tracker', stages: [...READY_FOR_PRODUCTION, ...IN_PRODUCTION] }
    ]
  },
  {
    key: 'tracker',
    name: 'Dispatch Tracker',
    desc: 'Where every released order stands, from the production line to a completed installation.',
    // Linear: seven stages in the order an order passes through them.
    // The mockup's own layout: "Ready for dispatch" and "Vehicle held" share a column as a branch.
    columns: [['rfp'], ['inprod'], ['rfd', 'held'], ['dispatched'], ['delivered'], ['installed']],
    cards: [
      { key: 'rfp', label: 'Ready for production', tone: 'violet', sub: 'Approved for production · production not started', stages: READY_FOR_PRODUCTION },
      { key: 'inprod', label: 'In production', tone: 'blue', sub: 'Production started · not done', stages: IN_PRODUCTION },
      { key: 'rfd', label: 'Ready for dispatch', tone: 'amber', sub: 'Production done · not dispatched', stages: READY_FOR_DISPATCH },
      {
        key: 'held',
        label: 'Vehicle held',
        tone: 'red',
        sub: 'Ready for dispatch but the vehicle is held',
        available: false,
        why: 'Zoho records no vehicle hold — there is no such field and no such stage.'
      },
      { key: 'dispatched', label: 'Dispatched', tone: 'teal', sub: 'Left the factory · not delivered yet', stages: DISPATCHED },
      { key: 'delivered', label: 'Delivered', tone: 'green', sub: 'Delivered to site · installation not complete', stages: DELIVERED },
      { key: 'installed', label: 'Installed', tone: 'ink', sub: 'Installation complete', stages: INSTALLED }
    ]
  }
];

// ---------------------------------------------------------------------------
// Complaints — AMS_Complaints, 3,388 records and genuinely filled
// ---------------------------------------------------------------------------
// The one part of this board whose own module is in good order. Record_Type separates AMS visits
// from complaints, and Complaint_Date / AMS_Completed_Date give real open and close dates, so the
// aging and time-to-resolve figures are measured rather than inferred.
//
// What the mockup showed and Zoho cannot: routing between Design, Factory, Installation and
// Services, the per-hop SLA table, and "at fault" by department. None of that is modelled. The
// nearest real field is Complaint_From (Client End | Installation Team | AMS), which says where a
// complaint came IN from, not who caused it — so it is shown as "Raised from" and never as fault.
export const COMPLAINT_STATUSES = ['Not Started Yet', 'In Process', 'Hold', 'QA Done', 'Completed'];
export const COMPLAINT_STAGES = ['Open', 'Sent to QC', 'Sent to Planning', 'Sent for Purchase', 'Approved by IM'];
export const COMPLAINT_PRIORITIES = ['High', 'Medium', 'Low'];
export const COMPLAINT_SOURCES = ['Client End', 'Installation Team', 'AMS'];

// How long a complaint may sit before it is called aging. The mockup used a per-hop SLA table that
// has no source in Zoho; this is a single, stated threshold instead of an invented one.
export const COMPLAINT_AGING_DAYS = 7;
