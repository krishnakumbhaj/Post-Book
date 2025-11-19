# RD Bulk Deposit - Requirements & Rules

This document summarizes the RD bulk deposit rules and the backend requirements discussed in the previous conversation. Implement this as a server-side feature (API + DB) to allow an Agent to deposit multiple installments across one or many RD accounts in a single operation.

## Terminology
- Agent: a privileged user who can make deposits for one or more RD accounts belonging to a user.
- RD Account: recurring deposit account with fields such as `accountNo`, `accountName`, `openingDate`, `denomination` (Decimal128), `totalDepositAmount` (Decimal128), `monthPaidUpTo` (number), `nextInstallmentDueDate` (Date), `lastDepositDate` (Date).

## Core rules (from user)
1. Agent can select multiple RD accounts for a user and choose how many installments to pay for each selected account.
2. For each account selected, the contribution equals `denomination * installmentsSelected`.
3. Standard operation limit: the sum of all contributions in one bulk operation must not exceed `20,000` (currency units).
4. Maximum installments selectable per account: `12` (one year). Clarify: this is per-account maximum for a single selection.
5. Special exception: If only a single account is selected and the Agent selects exactly `12` installments for that single account, the `20,000` aggregate limit does NOT apply. Example: denomination `4,000` with 12 installments (48,000) is allowed when it is the only account selected and 12 installments are chosen.
6. If a single account is selected with fewer than 12 installments (e.g., 11), the 20,000 limit still applies.

## Behavioral rules for applying payment
- Validate that the Agent is authorized for the selected accounts and that each account belongs to the same target user.
- Validate `installmentsSelected` is integer, `1 <= installmentsSelected <= 12`.
- Calculate per-account contribution and total contribution using Decimal128 arithmetic server-side.
- Apply the special single-account + 12-installments exception before enforcing the 20,000 max rule.
- If validation fails, return a clear error code and message describing which rule was violated.

## Fields to update on success
For each affected account:
- `monthPaidUpTo += installmentsSelected`
- `totalDepositAmount += denomination * installmentsSelected` (store as Decimal128)
- `nextInstallmentDueDate += installmentsSelected months` (use the current `nextInstallmentDueDate` as the base)
- `lastDepositDate = paymentDate` (set to the Agent's payment datetime) — confirm if other behavior is desired.

## Transaction & concurrency
- Perform the entire bulk update inside a MongoDB transaction (mongoose session) so the operation is atomic.
- Handle duplicate key and transient errors; either retry or return an explicit failure response.

## API shape (suggested)
- Endpoint: `POST /api/rd-account/bulk-pay`
- Request body:
	```json
	{
		"userId": "<user id>",
		"payments": [ { "accountId": "<id>", "installments": 3 }, ... ]
	}
	```
- Response (success): HTTP 200/201 with updated accounts array and totals:
	```json
	{
		"ok": true,
		"updatedAccounts": [ ... ],
		"totalAmount": "20000"
	}
	```

## Validation summary
- Ensure `MONGODB_URI`, `NEXTAUTH_SECRET`, and Agent session/authorization are present.
- Server computes all monetary math using Decimal128 to avoid precision loss.
- Enforce the 20,000 aggregate limit except for the single-account + 12-installment exception.

## Implementation Status (✅ COMPLETED)

### Backend Models
- ✅ `PaymentSession` model (`src/models/PaymentSession.ts`) — staging/organizer schema with items, status, payment method, and revert window
- ✅ `PaymentRecord` model (`src/models/PaymentRecord.ts`) — audit trail with before/after snapshots and reversal support

### Backend API Routes
- ✅ `POST /api/rd-account/payment-session` — create or get existing draft session
- ✅ `GET /api/rd-account/payment-session` — list sessions for agent (filterable by status/user)
- ✅ `GET /api/rd-account/payment-session/[id]` — get specific session
- ✅ `PATCH /api/rd-account/payment-session/[id]` — update session (add/remove items, toggle added flag)
- ✅ `DELETE /api/rd-account/payment-session/[id]` — cancel draft/ongoing session
- ✅ `POST /api/rd-account/payment-session/[id]/commit` — validate rules, apply updates in transaction, create PaymentRecords
- ✅ `POST /api/rd-account/payment-session/[id]/revert` — undo committed payments within 30-day window

### Business Rules Implemented
- ✅ Cash payment: enforce 20,000 aggregate limit
- ✅ Check payment: no aggregate limit
- ✅ Per-account installments: 0–12 (0 = no-op/ignore)
- ✅ Atomic transaction for all updates
- ✅ Before/after snapshots in PaymentRecord
- ✅ 7-day revert window from commit date (updated from 30 days)
- ✅ Prevent double-commit with status checks

### Frontend Pages
- ✅ `src/app/rd-account/report/page.tsx` — account selection UI with search, installment controls, floating cart, payment method selector (cash/check), and Add to Report functionality
- ✅ `src/app/rd-account/confirm-report/page.tsx` — lists sessions with added items, commit/revert UI with countdown timer, cancel functionality

### Complete Workflow
1. ✅ Agent clicks "Create Report" button → navigates to `/rd-account/report`
2. ✅ Payment session auto-created on page load (draft status)
3. ✅ Agent selects accounts → accounts added to floating cart with 1 installment default
4. ✅ Agent adjusts installment count (1-12) using +/- buttons
5. ✅ Agent selects payment method: Cash (max ₹20,000) or Check (no limit)
6. ✅ Validation: Cash payments exceeding ₹20,000 show error and disable "Add to Report"
7. ✅ "Add to Report" → marks all items as added, redirects to `/rd-account/confirm-report`
8. ✅ Confirm page shows all ongoing sessions with added items
9. ✅ "Commit Payment" → executes atomic transaction, updates all accounts, creates PaymentRecords
10. ✅ Committed sessions show revert countdown (7 days from commit)
11. ✅ "Revert Payment" → undoes changes within 7-day window, creates reversal records
12. ✅ Session states: draft → ongoing (when items added) → committed/cancelled

### Next Steps
1. ~~Create `/rd-account/confirming-report` page to list sessions with `added: true` items and provide commit/revert UI~~ ✅ COMPLETED
2. ~~Wire frontend batch selection to backend APIs~~ ✅ COMPLETED
3. ~~Add payment method selector (cash/check) to UI~~ ✅ COMPLETED
4. Optional: Add bulk-pay direct endpoint for one-shot operations without session staging
5. Optional: Add user selection dropdown for agents to work with different users' accounts
6. Optional: Add check info input (check number, bank, issue date) before commit

---

Example account (single):

Account No: 020001065478

Account Name: KALPANA

Account Opening Date: 15-Jan-2021

Denomination: 1,000.00

Total Deposit Amount: 58,000.00

Month Paid Up to: 58

Next RD Installment due date: 15-Nov-2025

Date of Last Deposit: 14-Oct-2025

If one installment is paid, it becomes:

Total Deposit Amount: 59,000.00

Month Paid Up to: 59

Next RD Installment due date: 15-Dec-2025

Date of Last Deposit: (payment date)





















Account No:
020001065478

Account Name:
KALPANA

Account Opening Date:
15-Jan-2021

Denomination:
1,000.00

Total Deposit Amount:
59,000.00

Month Paid Up to:
59

Next RD Installment due date:
15-Dec-2025

Date of Last Deposit:
14-Oct-2025z

Pending installments:
1