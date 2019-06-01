CREATE OR REPLACE VIEW current_users AS
    SELECT
        id AS "userId",
        full_name AS "fullName",
        display_name AS "displayName",
        email,
        plan,
        version_number AS "versionNumber",
        is_deleted AS "isDeleted",
        is_most_recent AS "isMostRecent",
        changeset_id as "changesetId"
    FROM
        users u
        INNER JOIN user_versions v ON u.id = v.user_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_budgets AS
    SELECT
        id AS "budgetId",
        name,
        version_number AS "versionNumber",
        is_deleted AS "isDeleted",
        is_most_recent AS "isMostRecent",
        changeset_id as "changesetId"
    FROM
        budgets b
        INNER JOIN budget_versions v ON b.id = v.budget_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_nodes AS
    SELECT
        id AS "nodeId",
        budget_id AS "budgetId",
        path,
        label,
        name,
        opening_date as "openingDate",
        closing_date as "closingDate",
        version_number as "versionNumber",
        is_deleted AS "isDeleted",
        is_most_recent AS "isMostRecent",
        changesetId AS "changesetId"
    FROM
        nodes n
        INNER JOIN node_versions v ON n.id = v.node_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_transactions AS
    SELECT
        id AS "transactionId",
        budget_id AS "budgetId",
        date,
        description,
        version_number as "versionNumber",
        is_deleted AS "isDeleted",
        is_most_recent AS "isMostRecent",
        changesetId AS "changesetId"
    FROM
        transactions t
        INNER JOIN transaction_versions v ON t.id = v.transaction_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_postings AS
    SELECT
        id AS "postingId",
        transaction_id AS "transactionId"
        node_id AS "nodeId",
        amount,
        description,
        version_number as "versionNumber",
        is_deleted AS "isDeleted",
        is_most_recent AS "isMostRecent",
        changesetId AS "changesetId"
    FROM
        postings p
        INNER JOIN posting_versions v ON p.id = v.posting_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;
