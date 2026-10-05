# Live Lab 0.6.0 — Paper Exchange AUTO

- Paper bankroll default: €200
- Dynamic stake: Tier B 5%, Tier A 7.5%, Tier A strong (score >=95) 10%
- Hard cap: 10% of current bankroll per trade
- Goal Pressure execution: 4 equal tranches at alert price, +25, +50 and +75 Betfair ticks
- Real Betfair market prices are read for simulation; no real order is sent
- Pending tranches are cancelled after a goal
- Paper cashout uses the available lay price after the goal and applies 4.5% commission on positive P/L
- New Paper Exchange dashboard and trade history
- Extension 0.6.0 adds Betfair App Key + session test; username/password are not stored

Current automatic execution is intentionally enabled only for Goal Pressure. Other strategy alerts remain active but wait for their own course-derived execution rules.
