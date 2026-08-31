-- Steward V1 domain schema (Person, Household, Stock, Catalog, Money, Shopping, Calendar).

CREATE TABLE IF NOT EXISTS person (
    id TEXT PRIMARY KEY NOT NULL,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    default_currency TEXT NOT NULL DEFAULT 'USD',
    default_household_id TEXT,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    token_hash TEXT PRIMARY KEY NOT NULL,
    person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_person ON session(person_id);

CREATE TABLE IF NOT EXISTS household (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    owner_person_id TEXT NOT NULL REFERENCES person(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS household_member (
    household_id TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member', 'guest')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (household_id, person_id)
);

CREATE TABLE IF NOT EXISTS location (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'generic' CHECK (kind IN ('generic', 'fridge', 'freezer', 'pantry')),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_location_household ON location(household_id);

CREATE TABLE IF NOT EXISTS product (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    barcode TEXT,
    purchase_unit TEXT NOT NULL DEFAULT 'pcs',
    consumption_unit TEXT NOT NULL DEFAULT 'pcs',
    unit_conversion REAL NOT NULL DEFAULT 1.0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_barcode ON product(barcode);

CREATE TABLE IF NOT EXISTS store (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS store_price (
    id TEXT PRIMARY KEY NOT NULL,
    store_id TEXT NOT NULL REFERENCES store(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (store_id, product_id, currency)
);

CREATE TABLE IF NOT EXISTS stock_entry (
    id TEXT PRIMARY KEY NOT NULL,
    household_id TEXT NOT NULL REFERENCES household(id) ON DELETE CASCADE,
    location_id TEXT NOT NULL REFERENCES location(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES product(id),
    quantity REAL NOT NULL CHECK (quantity >= 0),
    expires_on TEXT,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_stock_household_product ON stock_entry(household_id, product_id);

CREATE TABLE IF NOT EXISTS budget (
    id TEXT PRIMARY KEY NOT NULL,
    person_id TEXT NOT NULL UNIQUE REFERENCES person(id) ON DELETE CASCADE,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS budget_transaction (
    id TEXT PRIMARY KEY NOT NULL,
    budget_id TEXT NOT NULL REFERENCES budget(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('expense', 'income', 'transfer')),
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    fx_to_budget REAL,
    memo TEXT,
    created_at TEXT NOT NULL,
    idempotency_key TEXT UNIQUE
);

CREATE INDEX IF NOT EXISTS idx_budget_tx_budget ON budget_transaction(budget_id);

CREATE TABLE IF NOT EXISTS fund (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    default_currency TEXT NOT NULL,
    settlement_strategy TEXT NOT NULL DEFAULT 'equal_shares'
        CHECK (settlement_strategy IN ('equal_shares', 'one_payer', 'custom_shares')),
    household_id TEXT REFERENCES household(id) ON DELETE SET NULL,
    owner_person_id TEXT NOT NULL REFERENCES person(id),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fund_participant (
    fund_id TEXT NOT NULL REFERENCES fund(id) ON DELETE CASCADE,
    person_id TEXT NOT NULL REFERENCES person(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('owner', 'member', 'guest')),
    created_at TEXT NOT NULL,
    PRIMARY KEY (fund_id, person_id)
);

CREATE TABLE IF NOT EXISTS fund_revision (
    id TEXT PRIMARY KEY NOT NULL,
    fund_id TEXT NOT NULL REFERENCES fund(id) ON DELETE CASCADE,
    revision_number INTEGER NOT NULL,
    balances_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (fund_id, revision_number)
);

CREATE TABLE IF NOT EXISTS accounting_entry (
    id TEXT PRIMARY KEY NOT NULL,
    fund_id TEXT NOT NULL REFERENCES fund(id) ON DELETE CASCADE,
    source_command TEXT NOT NULL,
    idempotency_key TEXT NOT NULL,
    deltas_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (fund_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_accounting_fund ON accounting_entry(fund_id, created_at);

CREATE TABLE IF NOT EXISTS shopping_list (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('budget', 'fund')),
    owner_id TEXT NOT NULL,
    target_household_id TEXT REFERENCES household(id) ON DELETE SET NULL,
    created_by_person_id TEXT NOT NULL REFERENCES person(id),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_list_owner ON shopping_list(owner_kind, owner_id);

CREATE TABLE IF NOT EXISTS shopping_item (
    id TEXT PRIMARY KEY NOT NULL,
    shopping_list_id TEXT NOT NULL REFERENCES shopping_list(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES product(id),
    status TEXT NOT NULL DEFAULT 'needed'
        CHECK (status IN ('needed', 'in_cart', 'purchased')),
    quantity_needed REAL NOT NULL CHECK (quantity_needed > 0),
    quantity_purchased REAL NOT NULL DEFAULT 0 CHECK (quantity_purchased >= 0),
    preferred_store_id TEXT REFERENCES store(id) ON DELETE SET NULL,
    last_price_minor INTEGER,
    last_price_currency TEXT,
    updated_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shopping_item_list ON shopping_item(shopping_list_id);

CREATE TABLE IF NOT EXISTS calendar (
    id TEXT PRIMARY KEY NOT NULL,
    owner_kind TEXT NOT NULL CHECK (owner_kind IN ('household', 'person')),
    owner_id TEXT NOT NULL,
    name TEXT NOT NULL,
    system_kind TEXT CHECK (system_kind IN ('expiry', 'meal_plan') OR system_kind IS NULL),
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_owner ON calendar(owner_kind, owner_id);

CREATE TABLE IF NOT EXISTS calendar_event (
    id TEXT PRIMARY KEY NOT NULL,
    calendar_id TEXT NOT NULL REFERENCES calendar(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    starts_on TEXT NOT NULL,
    ends_on TEXT,
    notes TEXT,
    recipe_id TEXT,
    portions REAL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_calendar_event_cal ON calendar_event(calendar_id, starts_on);

CREATE TABLE IF NOT EXISTS recipe (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredient (
    recipe_id TEXT NOT NULL REFERENCES recipe(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL REFERENCES product(id),
    quantity REAL NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (recipe_id, product_id)
);
