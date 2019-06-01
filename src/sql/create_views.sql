CREATE OR REPLACE VIEW current_users AS
    SELECT *
    FROM
        users u
        INNER JOIN user_versions v ON u.id = v.user_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_budgets AS
    SELECT *
    FROM
        budgets b
        INNER JOIN budget_versions v ON b.id = v.budget_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_nodes AS
    SELECT *
    FROM
        nodes n
        INNER JOIN node_versions v ON n.id = v.node_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_transactions AS
    SELECT *
    FROM
        transactions t
        INNER JOIN transaction_versions v ON t.id = v.transaction_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;

CREATE OR REPLACE VIEW current_postings AS
    SELECT *
    FROM
        postings p
        INNER JOIN posting_versions v ON p.id = v.posting_id
    WHERE
        v.is_most_recent = true
        AND v.is_deleted = false;
