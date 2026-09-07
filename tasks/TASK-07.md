# TASK 7 — Tip on orders

Orders may include optional `tip_cents` (non-negative integer). Default 0 when omitted. `total_cents` on the order must equal the sum of line totals plus `tip_cents`. Reject negative tips with 400. Return `tip_cents` on create and fetch. Prior tasks must still pass.
