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
    SELECT node.*, version.*, parent.id AS parent_id
    FROM
        nodes node
        INNER JOIN node_versions version ON node.id = version.node_id
        LEFT JOIN nodes parent ON parent.label = ltree2text(subpath(node.path, -2, -1)) AND parent.budget_id = node.budget_id
    WHERE
        version.is_most_recent = true
        AND version.is_deleted = false;

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
