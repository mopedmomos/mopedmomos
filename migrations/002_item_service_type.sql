ALTER TABLE order_items ADD COLUMN service_type TEXT NOT NULL DEFAULT 'takeaway' CHECK(service_type IN ('takeaway','dine-in'));
UPDATE order_items SET service_type=(SELECT order_type FROM orders WHERE orders.id=order_items.order_id);
