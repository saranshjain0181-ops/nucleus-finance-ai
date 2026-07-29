# Accounting Module + Auto-Extract from Uploaded Documents

## What you get

1. **A new "Ledger & Books" view** where you build a general ledger, and the app derives a Trial Balance and a Balance Sheet automatically.
2. **Uploaded documents (one or many) are read and parsed** — CSV, Excel, PDF, DOCX, TXT — and the extracted figures flow into the ledger and into the Calculator Matrix inputs, so calculators pre-fill from your own files instead of sample data.

## 1. Ledger, Trial Balance, Balance Sheet

New route `/ledger` (sidebar entry "Ledger & Books") with three tabs:

- **General Ledger** — editable table of journal entries: date, account, account type (asset / liability / equity / revenue / expense), description, debit, credit. Add/edit/delete rows, plus a live "Debits − Credits" balance indicator that turns red when out of balance.
- **Trial Balance** — auto-grouped by account, showing total debit and credit per account, with grand totals and a balanced/unbalanced badge.
- **Balance Sheet** — Assets vs. Liabilities + Equity, with retained earnings computed from revenue − expenses, subtotals, and an assets-equals-liabilities-plus-equity check.

Everything persists in the existing local store (`finance-store`) alongside the current P&L data, and is included in the JSON export and the PDF pitch deck export.

## 2. Document ingestion → structured extraction

Extend the existing Data Ingestion page:

- **CSV / Excel**: extended parser recognises accounting-style columns (account, type, debit, credit, or label/value/category) and can route rows to either the P&L custom rows or the ledger.
- **PDF / DOCX / TXT**: text is extracted client-side (pdfjs for PDF, mammoth for DOCX) instead of being stored as an opaque reference; the extracted text is kept with the attachment.
- **Field mapping**: extracted text/tables are scanned for known financial line items (revenue, COGS, salaries, marketing, cash, ARR, CAC, churn, headcount, etc.) using labelled-number patterns.
- **Review step**: a "Detected values" panel lists every match with its source file and lets you accept/reject each one before it is written to state — nothing overwrites your data silently.
- **AI-assisted fallback**: if pattern matching finds little and a Gemini key is saved, the document text is sent to Gemini with a strict JSON schema to return line items; results land in the same review panel.

## 3. Feeding the Calculator Matrix

- A new mapping layer connects extracted/ledger figures to calculator input ids (e.g. cash → Runway, monthly burn → Runway/Burn Multiple, revenue & COGS → margin calcs, S&M → Magic Number/CAC).
- The Calculator Matrix header gains a **"Fill from my data"** button next to "Auto-Fill Sample Data", which pushes those values in through the existing patch channel — so the current Undo / Redo / Reset Matrix and Optimization History controls work on it too, and touched cards show a "From documents" badge.

## Technical notes

- New files: `src/routes/ledger.tsx`, `src/lib/ledger.ts` (trial balance + balance sheet derivations), `src/lib/doc-extract.ts` (text extraction + pattern matching), `src/lib/matrix-mapping.ts` (extracted field → calculator input ids).
- Changed: `finance-store.tsx` (ledger entries, extracted-field records, attachment text), `routes/data.tsx` (multi-format extraction + review panel), `routes/calculators.tsx` (Fill from my data), `AppSidebar.tsx`, PDF export.
- New deps: `pdfjs-dist`, `mammoth`. Parsing is entirely in the browser; documents are never uploaded to a server.
