INSERT INTO customers (id, name, email) VALUES
  (1, 'Alice Chen', 'alice@example.com'),
  (2, 'Bob Patel', 'bob@example.com');

INSERT INTO menu_items (id, sku, name, description, category, price_cents, active) VALUES
  (1, 'ESP-001', 'Espresso', 'Double shot espresso', 'drink', 350, 1),
  (2, 'LAT-001', 'Latte', 'Espresso with steamed milk', 'drink', 450, 1),
  (3, 'CRO-001', 'Croissant', 'Butter croissant', 'food', 300, 1),
  (4, 'MUF-001', 'Blueberry muffin', 'Daily baked muffin', 'food', 250, 1),
  (5, 'OLD-001', 'Seasonal special', 'No longer offered', 'drink', 100, 0);

PRAGMA foreign_keys = ON;
