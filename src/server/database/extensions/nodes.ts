import * as _ from 'lodash';
import * as uuid from 'uuid';
import {Logger} from '../../../common/util/Logger';

import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {Domain} from '../../models/Domain';
import {Layer} from '../../models/Layer';
import {createBudgetChangeset, singleRow} from './utils';
import {DbClient, IBudgetUser, IVersionedEntity} from '../DbClient';

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
	parent_id: string;
}

interface IRootPrimaryKey {
	budgetId: string;
	domain: Domain;
	layer: Layer;
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

export interface ICreateRootNode extends INodePrimaryKey {
	budgetId: string;
	name: string;
}

export interface ICreateChildNode extends INodeImmutable, INodeVersion, IBudgetUser {}

export interface IUpdateNode extends INodeVersion, IBudgetUser {}

export interface IDeleteNode extends INodePrimaryKey, IBudgetUser {}

export interface INodeEntity extends INodeImmutable, INodeVersion, IVersionedEntity {}


//// Methods for the DbClient class

export async function createRootNode(
	this: DbClient,
	changesetId: string,
	{ budgetId, nodeId, name}: ICreateRootNode
): Promise<void> {
	const {nextval: label} = await singleRow(this.parameterisedQuery`
		SELECT nextval('node_label_seq')`);

	await this.parameterisedQuery`
		INSERT INTO nodes
			(id, budget_id, path, label)
		VALUES
			(${nodeId}, ${budgetId}, ${label}, ${label})`;


	await this.parameterisedQuery`
		INSERT INTO node_versions
			(node_id, version_number,  name, opening_date, closing_date, is_most_recent, is_deleted, changeset_id)
		VALUES
			(${nodeId}, 1, ${name}, NOW(), NULL, true, false, ${changesetId})`;
}

export async function createChildNode(
	this: DbClient,
	{userId, budgetId, nodeId, parentNodeId, name, openingDate, closingDate}: ICreateChildNode
): Promise<void> {
	await this.withDatabaseTransaction(async () => {

		await this.assertUserCanWriteToBudget({userId, budgetId});
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.CreateNode);

		const parentNode = await singleRow<INodeDatabaseRow>(this.parameterisedQuery`
			SELECT *
			FROM current_nodes
			WHERE id = ${parentNodeId}`);

		const {nextval: label} = await singleRow(this.parameterisedQuery`
			SELECT nextval('node_label_seq')`);

		const path = `${parentNode.path}.${label}`;
		await this.parameterisedQuery`
			INSERT INTO nodes
				(id, budget_id, path, label)
			VALUES
				(${nodeId}, ${budgetId}, ${path}, ${label})`;

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

export async function getNodeById(
	this: DbClient,
	{userId, budgetId, nodeId}: IBudgetUser & INodePrimaryKey
): Promise<INodeEntity | null> {
	await this.assertUserCanReadBudget({userId, budgetId});
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT *
		FROM current_nodes
		WHERE node_id = ${nodeId}`;
	return (rowCount === 0) ? null : getNodeEntityFromDatabaseRow(rows[0]);
}

export async function getNodesForBudget(
	this: DbClient,
	{userId, budgetId}: IBudgetUser
): Promise<INodeEntity[]> {
	await this.assertUserCanReadBudget({userId, budgetId});
	const {rows} = await this.parameterisedQuery`
		SELECT *
		FROM current_nodes n
		WHERE budget_id = ${budgetId}`;

	return rows.map(getNodeEntityFromDatabaseRow);
}

export async function getRootNode(
	this: DbClient,
	{userId, budgetId, domain, layer}: IBudgetUser & IRootPrimaryKey
): Promise<INodeEntity> {
	await this.assertUserCanReadBudget({userId, budgetId});
	const row = await singleRow<INodeDatabaseRow>(this.parameterisedQuery`
		SELECT *
		FROM 
			current_nodes n
			LEFT JOIN roots r ON n.id = r.node_id  
		WHERE 
			r.budget_id = ${budgetId}
			AND r.domain = ${domain}
			AND r.layer = ${layer}`);

	Logger.log('rows:', row);
	return getNodeEntityFromDatabaseRow(row);
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
		parentNodeId: row.parent_id,
		name: row.name,
		openingDate: row.opening_date,
		closingDate: row.closing_date,
		versionNumber: row.version_number,
		isDeleted: row.is_deleted,
		isMostRecent: row.is_most_recent,
		changesetId: row.changeset_id
	}
}
