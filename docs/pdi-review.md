# PDI & Site Review mapping

Two shared design-style cards open table-first dialogs with a chart/table switch. PDI Verification Done shows only verified orders. Ready for Dispatch or Pending shows the full PDI/readiness cohort, with dispatched orders separated. Chart segments and status dropdowns filter the same table records.

Scope: real Magppie orders created in the chosen reporting period with a PDI status, PDI activity/date, or dispatch-readiness date/stage. Sunroof and test orders are excluded, preserving the former PDI scope. Client and designer counts include all real Magppie orders in that period, not just visible rows.

- Verification: `PDI_Status = Approved`, or exact stage `Site Approved for Dispatch`, `Sent for PDI payment Approval`, or `PDI Payment Done`. `PDI_Visit_done` and `PDI_Done` alone do not prove verification approval.
- Payment Done: `Payment_Milestones.Milestone_Number = PDI Approval`, joined through `Payment_M_X_Orders.Orders` and `.Payment_Milestones`. All linked PDI milestones must be `Paid` or `Paid/Confirmed` for Done. Partial/unpaid/unknown values remain separate. Duplicate links are deduplicated. Exact order stage `PDI Payment Done` is a fallback only when no linked PDI milestone exists. Payment read failure is disclosed as Unavailable; attachments do not prove payment.
- Dispatch: `Dispatch_done` means Dispatched; otherwise `Ready_For_Dispatch_done` means Ready for Dispatch; otherwise Pending. Missing readiness dates are missing evidence, not a claim that production is unfinished.
- Pending reason: explicit PDI status, PDI payment status, and recorded/missing readiness approval. These are derived explanations, not a CRM free-text dispatch reason. General `Remarks` appear separately and are not relabelled as a dispatch reason.
- Real measurement, area, height, owner, designer, revision and PDI date fields are returned without estimated dimensions, appliance specifications, payment percentages or default completion dates.

Source: `backend/src/services/pdiReview.js`, `frontend/src/components/PdiDashboard.jsx`.
