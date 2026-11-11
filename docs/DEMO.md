# Demo script

Written in Phase 4. The build must support these five beats (from `CLAUDE.md`):

1. Merchant verifies in the console, links agent, badge appears.
2. Buyer chats with the agent, taps verify link, sees verdict.
3. A clone agent with a copied badge is flagged (channel mismatch).
4. A buyer agent calls `verify_agent` over MCP, gets `VERIFIED`, pays.
5. Receipt opens with anchored offer, verified merchant, payment reference.

Testnet fixtures for NOT_VERIFIED cases are listed in `docs/DECISIONS.md`.
