CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    inventory_name VARCHAR(100) NOT NULL,
    description TEXT,
    photo VARCHAR(255)
);
