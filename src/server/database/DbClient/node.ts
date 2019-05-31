import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {createBudgetChangeset} from './changesets';
import {DbClient, IBudgetChangeset} from '.';

interface INodeId {
	nodeId: string;
}

interface INodeImmutable {

}

export interface INode extends IBudgetChangeset {
	nodeId: string;
	parentNodeId: string;
	name: string;
	openingDate: Date;
	closingDate?: Date;
}

export async function createNode(
	this: DbClient,
	{nodeId, userId, budgetId, parentNodeId, name, openingDate, closingDate}: INode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.CreateNode);
		await this.parameterisedQuery`
				WITH _path AS (
					SELECT CONCAT(path, '.', label)
					FROM nodes
					WHERE budget_id = ${budgetId} AND id = ${parentNodeId}
				)
				INSERT INTO nodes
					(id, budget_id, path)
				VALUES
					(${nodeId}, ${budgetId}, _path)`;

		await this.parameterisedQuery`
				INSERT INTO node_versions
					(node_id, version_number,  name, opening_date, closing_date, is_most_recent, is_deleted, changeset_id)
				VALUES
					(${nodeId}, 0, ${name}, ${openingDate}, ${closingDate}, true, false, ${changesetId})`;
	});
}

export async function updateNode(
	this: DbClient,
	{nodeId, userId, budgetId, parentNodeId, name, openingDate, closingDate}: INode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnNode.call(this, nodeId);
		await throwErrorIfIsRootNode.call(this, budgetId, nodeId, 'Cannot update a root node');
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.UpdateNode);
		await this.parameterisedQuery`
				WITH prev AS (
					UPDATE node_versions
					SET is_most_recent = false
					WHERE node_id = ${nodeId} AND is_most_recent = true
					RETURNING *
				)
				INSERT INTO node_versions
					(node_id, version_number,  name, opening_date, closing_date, is_most_recent, is_deleted, changeset_id)
				VALUES
					(${nodeId}, prev.version_number + 1, ${name}, ${openingDate}, ${closingDate}, true, false, ${changesetId})`;
	});
}

export async function deleteNode(
	this: DbClient,
	{nodeId, userId, budgetId}: INode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnNode.call(this, nodeId);
		await throwErrorIfIsRootNode.call(this, budgetId, nodeId, 'Cannot delete a root node');
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.DeleteNode);
		await this.parameterisedQuery`
				WITH prev AS (
				UPDATE node_versions
				SET is_most_recent = false
				WHERE node_id = ${nodeId} AND is_most_recent = true
				RETURNING *
			)
			INSERT INTO node_versions
				(node_id, version_number,  name, opening_date, closing_date, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${nodeId}, prev.version_number + 1, prev.name, prev.opening_date, prev.closing_date, true, true, ${changesetId})`;
	});
}

async function acquireLockOnNode(this: DbClient, nodeId: string) {
	// Acquire a lock on the row representing the node
	const {rowCount} = await this.parameterisedQuery`
			SELECT * FROM nodes WHERE id = ${nodeId} FOR UPDATE`;

	// Throw an error if the node doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching node');
	}
}

async function throwErrorIfIsRootNode(
	this: DbClient,
	budgetId: string,
	nodeId: string,
	message: string
): Promise<void> {
	const result = await this.parameterisedQuery`
		SELECT exists(
			SELECT 1 FROM roots WHERE budget_id = ${budgetId} AND node_id = ${nodeId}
		) AS "exists"`;

	if (result.rows[0].exists) {
		throw new Error(message);
	}
}
