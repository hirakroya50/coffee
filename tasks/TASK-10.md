# TASK 10 — Ready timestamp

When an order transitions to `READY`, set `ready_at` to the current timestamp. Before `READY`, `ready_at` is null. Include `ready_at` in order responses. Invalid status transitions remain 409. Prior tasks must still pass.
