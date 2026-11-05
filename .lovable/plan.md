# Phase 6: Strategic Scaling, ESG & Exit Simulation

## What you get

Four practical strategy views added to FinOps Studio:

1. **ESG & Carbon Ledger** — model compute emissions by region and estimate carbon tax and offset savings as infrastructure shifts to lower-carbon regions.
2. **Human Capital FinOps** — estimate fully-loaded team costs, inspect departments, and compare hiring-freeze versus growth scenarios against runway and P&L.
3. **Treasury FX Hedging** — view illustrative currency volatility and hedge suggestions, with local simulated execution status.
4. **Exit Simulator** — adjust ARR multiple and acquisition premium, then see debt, preferences, founder, and ESOP proceeds in a payout waterfall.

## Implementation

- Add distinct `/esg`, `/human-capital`, and `/exit-simulator` pages and sidebar entries; add FX hedging as a Treasury sub-view.
- Use existing finance state and chart/UI conventions where appropriate. Keep strategy assumptions editable and results visibly labeled as estimates or illustrative simulations.
- Build a department tree with expandable details and hiring scenario controls; apply scenario changes to a preview of operating costs/runway without silently overwriting the user's P&L.
- Use a deterministic illustrative FX series and local simulated hedge actions; no live market integration or real trade execution.
- Provide accessible controls and responsive layouts, add unique page metadata, then verify navigation and each module's core interactions in the preview.
