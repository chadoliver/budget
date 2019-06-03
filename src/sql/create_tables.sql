CREATE TABLE plans (
    id      UUID NOT NULL PRIMARY KEY,
    name    TEXT NOT NULL,
    cost    MONEY NOT NULL
);

CREATE TABLE users (
    id      UUID NOT NULL PRIMARY KEY
);

CREATE TABLE user_changesets (
    id                      UUID NOT NULL PRIMARY KEY,
    user_id                 UUID REFERENCES users(id) NOT NULL,
    hint                    USER_CHANGESET_HINT NOT NULL,
    timestamp               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE user_versions (
    user_id             UUID REFERENCES users(id) NOT NULL,
    version_number      INTEGER NOT NULL,
    full_name           text NOT NULL,
    display_name        text NOT NULL,
    email               text NOT NULL,
    plan                UUID REFERENCES plans(id) NOT NULL,
    is_deleted          BOOLEAN NOT NULL,
    is_most_recent      BOOLEAN NOT NULL,
    changeset_id        UUID REFERENCES user_changesets(id) NOT NULL,
    PRIMARY KEY (user_id, version_number)
);

CREATE TABLE budgets (
    id      UUID NOT NULL PRIMARY KEY
);

CREATE TABLE budget_changesets (
    id                      UUID NOT NULL PRIMARY KEY,
    user_id                 UUID REFERENCES users(id) NOT NULL,
    budget_id               UUID REFERENCES budgets(id) NOT NULL,
    hint                    BUDGET_CHANGESET_HINT NOT NULL,
    timestamp               TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE budget_versions (
    budget_id               UUID REFERENCES budgets(id) NOT NULL,
    version_number          INTEGER NOT NULL,
    name                    TEXT NOT NULL,
    is_deleted              BOOLEAN NOT NULL,
    is_most_recent          BOOLEAN NOT NULL,
    changeset_id            UUID REFERENCES budget_changesets(id) NOT NULL,
    PRIMARY KEY (budget_id, version_number)
);

CREATE TABLE permissions (
    user_id         UUID REFERENCES users(id) NOT NULL,
    budget_id       UUID REFERENCES budgets(id) NOT NULL,
    can_delete      BOOLEAN,
    can_share       BOOLEAN,
    can_write       BOOLEAN,
    can_read        BOOLEAN,
    PRIMARY KEY (user_id, budget_id)
);

CREATE TABLE nodes (
    id                  UUID PRIMARY KEY,
    budget_id           UUID REFERENCES budgets(id) NOT NULL,
    path                ltree,
    label               TEXT NOT NULL,
    UNIQUE (budget_id, label)
);

CREATE TABLE node_versions (
    node_id             UUID REFERENCES nodes(id) NOT NULL,
    version_number      INTEGER NOT NULL,
    name                TEXT NOT NULL,
    opening_date        DATE NOT NULL,
    closing_date        DATE,
    is_most_recent      BOOLEAN NOT NULL,
    is_deleted          BOOLEAN NOT NULL,
    changeset_id        UUID REFERENCES budget_changesets(id) NOT NULL,
    PRIMARY KEY (node_id, version_number)
);

CREATE TABLE roots (
    budget_id           UUID REFERENCES budgets(id) NOT NULL,
    domain              BUDGET_DOMAIN,
    layer               BUDGET_LAYER,
    node_id             UUID REFERENCES nodes(id) NOT NULL,
    PRIMARY KEY (budget_id, layer, domain)
);

CREATE TABLE transactions (
    id                  UUID PRIMARY KEY,
    budget_id           UUID NOT NULL REFERENCES budgets(id) NOT NULL
);

CREATE TABLE transaction_versions (
    transaction_id      UUID REFERENCES transactions(id) NOT NULL,
    version_number      INTEGER NOT NULL,
    date                DATE NOT NULL,
    description         TEXT NOT NULL,
    is_most_recent      BOOLEAN NOT NULL,
    is_deleted          BOOLEAN NOT NULL,
    changeset_id        UUID REFERENCES budget_changesets(id) NOT NULL,
    PRIMARY KEY (transaction_id, version_number)
);

CREATE TABLE postings (
    id                  UUID PRIMARY KEY,
    transaction_id      UUID REFERENCES transactions(id) NOT NULL
);

CREATE TABLE posting_versions (
    posting_id                  UUID REFERENCES postings(id) NOT NULL,
    version_number              INTEGER NOT NULL,
    node_id                     UUID REFERENCES nodes(id) NOT NULL,
    amount                      MONEY NOT NULL,
    description                 TEXT NOT NULL,
    is_most_recent              BOOLEAN NOT NULL,
    is_deleted                  BOOLEAN NOT NULL,
    changeset_id                UUID REFERENCES budget_changesets(id) NOT NULL,
    PRIMARY KEY (posting_id, version_number)
);
