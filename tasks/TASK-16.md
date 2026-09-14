# TASK 16 — Customer total orders

Extend `GET /customers/{id}` so the 200 response includes `total_orders`, an integer count of all orders belonging to that customer (every status, including CANCELLED). Customers with no orders must return `total_orders: 0`.

Add `total_orders` to the `Customer` schema in OpenAPI (required field). `POST /customers` should also return `total_orders: 0` for newly created customers.

Do not change existing endpoint paths or harness logic. Prior tasks must still pass. Keep OpenAPI, code, and tests synchronized.
