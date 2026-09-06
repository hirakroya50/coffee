INSERT INTO customers (id, name, email) VALUES
  (1, 'Alice Chen', 'alice@example.com'),
  (2, 'Bob Patel', 'bob@example.com')
ON CONFLICT (id) DO NOTHING;

INSERT INTO menu_items (id, sku, name, description, category, price_cents, active) VALUES
  (1, 'ESP-001', 'Espresso', 'Double shot espresso', 'drink', 350, 1),
  (2, 'LAT-001', 'Latte', 'Espresso with steamed milk', 'drink', 450, 1),
  (3, 'CRO-001', 'Croissant', 'Butter croissant', 'food', 300, 1),
  (4, 'MUF-001', 'Blueberry muffin', 'Daily baked muffin', 'food', 250, 1),
  (5, 'OLD-001', 'Seasonal special', 'No longer offered', 'drink', 100, 0)
ON CONFLICT (id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('customers', 'id'), COALESCE((SELECT MAX(id) FROM customers), 1));
SELECT setval(pg_get_serial_sequence('menu_items', 'id'), COALESCE((SELECT MAX(id) FROM menu_items), 1));
SELECT setval(pg_get_serial_sequence('orders', 'id'), COALESCE((SELECT MAX(id) FROM orders), 1));
SELECT setval(pg_get_serial_sequence('order_items', 'id'), COALESCE((SELECT MAX(id) FROM order_items), 1));
