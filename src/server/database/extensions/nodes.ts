import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {createBudgetChangeset} from './changesets';
import {DbClient, IBudgetUser, IVersionedEntity} from '../DbClient';
import {IUserEntity} from './users';

//// Interfaces

interface INodeDatabaseRow {
	id: string;
	budget_id: string;
	path: string;
	label: string;
	name: string;
	opening_date: Date;
	closing_date: Date;
	version_number: number;
	is_deleted: boolean;
	is_most_recent: boolean;
	changeset_id: string;
}

interface INodePrimaryKey {
	nodeId: string;
}

interface INodeImmutable extends INodePrimaryKey {
	budgetId: string;
	parentNodeId: string;
}

export interface INodeVersion extends INodePrimaryKey {
	name: string;
	openingDate: Date;
	closingDate?: Date;
}

export interface ICreateNode extends INodeImmutable, INodeVersion, IBudgetUser {}

export interface IUpdateNode extends INodeVersion, IBudgetUser {}

export interface IDeleteNode extends INodePrimaryKey, IBudgetUser {}

export interface INodeEntity extends INodeImmutable, INodeVersion, IVersionedEntity {}


//// Methods for the DbClient class

export async function createNode(
	this: DbClient,
	{userId, budgetId, nodeId, parentNodeId, name, openingDate, closingDate}: ICreateNode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {

		await this.assertUserCanWriteToBudget({userId, budgetId});
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.CreateNode);

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
	{nodeId, userId, budgetId, name, openingDate, closingDate}: IUpdateNode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {

		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnNode(this, nodeId);
		await throwErrorIfIsRootNode(this, budgetId, nodeId, 'Cannot update a root node');
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.UpdateNode);

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
	{nodeId, userId, budgetId}: IDeleteNode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {

		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnNode(this, nodeId);
		await throwErrorIfIsRootNode(this, budgetId, nodeId, 'Cannot delete a root node');
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.DeleteNode);

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


//// Helper functions

async function acquireLockOnNode(
	client: DbClient,
	nodeId: string
) {
	// Acquire a lock on the row representing the node
	const {rowCount} = await client.parameterisedQuery`
		SELECT * FROM nodes WHERE id = ${nodeId} FOR UPDATE`;

	// Throw an error if the node doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching node');
	}
}

async function throwErrorIfIsRootNode(
	client: DbClient,
	budgetId: string,
	nodeId: string,
	message: string
): Promise<void> {
	const result = await client.parameterisedQuery`
		SELECT exists(
			SELECT 1 FROM roots WHERE budget_id = ${budgetId} AND node_id = ${nodeId}
		) AS "exists"`;

	if (result.rows[0].exists) {
		throw new Error(message);
	}
}

function getNodeEntityFromDatabaseRow(row: INodeDatabaseRow): INodeEntity {
	return {
		nodeId: row.id,
		budgetId: row.budget_id,
		parentNodeId: '',			// TODO: need to figure out how to handle this.
		name: row.name,
		openingDate: row.opening_date,
		closingDate: row.closing_date,
		versionNumber: row.version_number,
		isDeleted: row.is_deleted,
		isMostRecent: row.is_most_recent,
		changesetId: row.changeset_id
	}
}
