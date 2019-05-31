CREATE TYPE BUDGET_LAYER AS ENUM (
    'location',
    'purpose'
);

CREATE TYPE BUDGET_DOMAIN AS ENUM (
    'internal',
    'external'
);

CREATE TYPE USER_CHANGESET_HINT as ENUM (
    'create-user',
    'update-user',
    'delete-user'
);

CREATE TYPE BUDGET_CHANGESET_HINT as ENUM (
    'create-budget',
    'update-budget',
    'delete-budget',
    'create-node',
    'update-node',
    'delete-node',
    'create-transaction',
    'update-transaction',
    'delete-transaction'
);
