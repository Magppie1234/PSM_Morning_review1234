# Post Design surface brief

This scoped extension lives under Design Monitoring Review → Post Design and uses the shared reporting period. The requested screenshot is a styling reference only; all requested columns remain available. Preserve the incumbent navy-and-white dashboard, compact typography, restrained borders and colored milestone accents. This brief does not replace or refresh the global visual system in `DESIGN.md` or `.impeccable/design.json`.

Five connected cards lead into a card-triggered order-table dialog: Design Approval → EP Electrical Plumbing → Moodboard Approval → PD Sign Out → PDI. Each card shows complete, pending and not-recorded counts, completion proportion and a clear selected state. Connections express the workflow, not proof that earlier milestones are complete. Cards and connectors reuse the Pre Design .lf styles and responsive stacking. On narrow screens the dialog fills the screen and its wide table scrolls horizontally; column headers and client identity remain anchored. Keyboard focus, loading, retry and empty-filter states must remain usable.

## Cohort and interaction

The board reads `/api/post-design-dashboard`. The cohort comprises real orders created in the selected period that have design evidence and have entered Post Design, as determined by the backend. It is not a count of milestones completed during that period. Every card tracks this same cohort, including completed milestones.

Designer and client/order search filters affect card counts and the table. Selecting a card opens its table dialog and resets the milestone-status filter. Status cells open that card’s table filtered to Complete, Pending, or Not recorded. Close or Escape dismisses the dialog and restores focus. No table is shown before a card is clicked. The status filter only narrows the table. Pending days sorts in either direction, with missing values last. Each row represents one order; retain client, order name and unique CRM order identity so similarly named orders can be distinguished. Field placement may prioritize the selected stage without changing these meanings.

Client order counts group by `Opportunity_Name.id`; designer order counts group by `Designer_Name`. Both count all real orders created in the selected period before Post Design eligibility and local filters, rather than the visible rows alone.

## Verified field mapping

| Surface information | Zoho Deals source / meaning |
| --- | --- |
| Client, order and designer | `Opportunity_Name.name` (fallback `Deal_Name`), `Deal_Name`, record `id`, `Designer_Name` |
| Revision count | Numeric `Number_of_Design_Revisions`; missing values are not zero |
| First measurement / measurement person | `Measurement_done`, falling back to `First_Measurement_Status`; `Site_Measurement_Person` |
| Design approval | `Design_Approved_Date` |
| EP marking / checking | `EPT_Marking_done` / `EPT_Verification_done`; a recorded corresponding `_open` date without completion displays Pending |
| Appliances received / appliance list | No verified physical-receipt field: receipt remains blank; nonempty `Signed_Appliances_List` means a signed list is on file |
| Moodboard | `Mood_Board_3D_Status`, `Mood_Board_Signoff_done` |
| Production drawing / PD sign-off | `Production_Drawing_Status`, `Production_Drawing_Signoff_done` |
| Payment evidence | Nonempty `Payment_Received_Document` means receipt on file; otherwise nonempty `Payment_Confirmation` means confirmation on file |
| PDI | `PDI_Status`, `Expected_PDI_date`, `Aligned_PDI_date`, `PDI_Visit_done` |

Each milestone independently determines completion: approval requires its approval date; EP accepts its sign-off completion date or `EPT_Status = Completed`; moodboard accepts its sign-off date or status Approved; PD sign-out requires its sign-off date; PDI accepts its visit completion date, `PDI_Done = true`, or status Approved. Later activity never supplies an earlier missing approval.

Pending means a recorded opening date or applicable activity status other than Not Started; otherwise the milestone is Not recorded. Pending days uses that milestone's opening date: `Send_For_Approval_Date`, `EPT_Signoff_open` (fallback `EPT_Marking_open`), `Mood_Board_Signoff_open`, `Production_Drawing_Signoff_open`, or `PDI_Visit_open`. Completed milestones and missing opening dates have no pending-days value. A dash denotes no verified value.

Payment evidence is order-level documentation. It does not confirm a PD Sign Out instalment or its amount. A signed appliance list does not confirm physical receipt. No money values, payment amounts or milestone completions are inferred from the screenshot or surrounding stages.

Source: `frontend/src/components/design/PostDesignBoard.jsx`, `frontend/src/styles/post-design.css`, `frontend/src/App.jsx`, and `backend/src/services/postDesignBoard.js`.
