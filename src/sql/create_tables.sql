CREATE TYPE BUDGET_LAYER AS ENUM ( 'location', 'purpose' );
CREATE TYPE BUDGET_DOMAIN AS ENUM ( 'internal', 'external' );

CREATE TABLE plans (
    id      UUID NOT NULL PRIMARY KEY,
    name    TEXT NOT NULL,
    cost    MONEY NOT NULL
);

CREATE TABLE users (
    id              UUID NOT NULL PRIMARY KEY,
    full_name       text,
    display_name    text,
    plan            UUID REFERENCES plans(id)
);

CREATE TABLE budgets (
    id                          UUID PRIMARY KEY,
    name                        TEXT NOT NULL,
    is_deleted                  BOOLEAN NOT NULL,
);

CREATE TABLE permissions (
    user_id         UUID NOT NULL REFERENCES users(id) NOT NULL,
    budget_id       UUID NOT NULL REFERENCES budgets(id) NOT NULL,
    can_delete      BOOLEAN,
    can_share       BOOLEAN,
    can_modify      BOOLEAN,
    can_read        BOOLEAN,
    PRIMARY KEY (user_id, budget_id)
);

CREATE TABLE commits (
    id                      UUID NOT NULL PRIMARY KEY,
    user_id                 UUID REFERENCES users(id) NOT NULL,
    budget_id               UUID REFERENCES budgets(id) NOT NULL,
    commit_number           INTEGER NOT NULL,
    acceptance_timestamp    TIMESTAMP,
    is_most_recent          BOOLEAN NOT NULL,
    UNIQUE (commit_number, budget_id)
);

CREATE TABLE node_hierarchy (
    id                  UUID PRIMARY KEY,
    label               SERIAL,
    path                ltree
);

CREATE TABLE roots (
    budget_id           UUID REFERENCES budgets(id) NOT NULL,
    layer               BUDGET_LAYER,
    domain              BUDGET_DOMAIN,
    node_id             UUID REFERENCES node_hierarchy(id) NOT NULL,
    PRIMARY KEY (budget_id, layer, domain)
);

CREATE TABLE nodes (
    id                  UUID REFERENCES node_hierarchy(id) NOT NULL,
    version_number      INTEGER NOT NULL,
    name                TEXT NOT NULL,
    opening_date        DATE NOT NULL,
    closing_date        DATE,
    is_most_recent      BOOLEAN NOT NULL,
    is_deleted          BOOLEAN NOT NULL,
    PRIMARY KEY (id, version_number)
);

CREATE TABLE transactions (
    id                  UUID NOT NULL,
    version_number      INTEGER NOT NULL,
    budget_id           UUID NOT NULL REFERENCES budgets(id) NOT NULL,
    date                DATE NOT NULL,
    description         TEXT NOT NULL,
    is_most_recent      BOOLEAN NOT NULL,
    is_deleted          BOOLEAN NOT NULL,
    PRIMARY KEY (id, version_number)
);

CREATE TABLE postings (
    id                  UUID NOT NULL,
    version_number      INTEGER NOT NULL,
    node_id             UUID REFERENCES node_hierarchy(id) NOT NULL,
    transaction_id      UUID NOT NULL,
    amount              MONEY NOT NULL,
    description         TEXT NOT NULL,
    is_most_recent      BOOLEAN NOT NULL,
    is_deleted          BOOLEAN NOT NULL,
    PRIMARY KEY (id, version_number)
);
