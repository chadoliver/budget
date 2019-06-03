import * as uuid from 'uuid';
import {Logger} from '../../../common/util/Logger';

import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {Domain} from '../../models/Domain';
import {Layer} from '../../models/Layer';
import {createRootNode} from './nodes';
import {createBudgetChangeset, singleRow} from './utils';
import {DbClient, IBudgetUser, IUser, IVersionedEntity} from '../DbClient';


//// Interfaces

interface IBudgetDatabaseRow {
	id: string;
	name: string;
	version_number: number;
	is_deleted: boolean;
	is_most_recent: boolean;
	changeset_id: string;
}

interface IBudgetPrimaryKey {
	budgetId: string;
}

interface IBudgetImmutable extends IBudgetPrimaryKey {}

interface IBudgetVersion extends IBudgetPrimaryKey {
	name: string;
}

export interface ICreateBudget extends IBudgetImmutable, IBudgetVersion, IBudgetUser {}
export interface IUpdateBudget extends IBudgetVersion, IBudgetUser {}
export interface IDeleteBudget extends IBudgetPrimaryKey, IBudgetUser {}
export interface IBudgetEntity extends IBudgetImmutable, IBudgetVersion, IVersionedEntity {}


//// Methods for the DbClient class

export async function createBudget(
	this: DbClient,
	{budgetId, userId, name}: ICreateBudget
): Promise<void>  {
	await this.withDatabaseTransaction(async (): Promise<void> => {
		await this.parameterisedQuery`
			INSERT INTO budgets
				(id)
			VALUES
				(${budgetId})`;

		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.CreateBudget);

		await this.parameterisedQuery`
			INSERT INTO permissions
				(user_id, budget_id, can_delete, can_share, can_write, can_read)
			VALUES
				(${userId}, ${budgetId}, ${true}, ${true}, ${true}, ${true})`;

		await this.parameterisedQuery`
			INSERT INTO budget_versions
				(budget_id, version_number, name, is_deleted, is_most_recent, changeset_id)
			VALUES
				(${budgetId}, 0, ${name}, false, true, ${changesetId})`;

		const internalLocationId = uuid.v4();
		const internalPurposeId = uuid.v4();
		const externalLocationId = uuid.v4();
		const externalPurposeId = uuid.v4();

		await this.createRootNode(changesetId, {budgetId, nodeId: internalLocationId, name: 'Internal Location'});
		await this.createRootNode(changesetId, {budgetId, nodeId: internalPurposeId, name: 'Internal Purpose'});
		await this.createRootNode(changesetId, {budgetId, nodeId: externalLocationId, name: 'External Location'});
		await this.createRootNode(changesetId, {budgetId, nodeId: externalPurposeId, name: 'External Purpose'});

		await this.parameterisedQuery`
			INSERT INTO roots
				(budget_id, domain, layer, node_id)
			VALUES
				(${budgetId}, ${Domain.Internal}, ${Layer.Location}, ${internalLocationId}),
				(${budgetId}, ${Domain.Internal}, ${Layer.Purpose}, ${internalPurposeId}),
				(${budgetId}, ${Domain.External}, ${Layer.Location}, ${externalLocationId}),
				(${budgetId}, ${Domain.External}, ${Layer.Purpose}, ${externalPurposeId})`;
	});
}

export async function updateBudget(
	this: DbClient,
	{budgetId, userId, name}: IUpdateBudget
): Promise<void> {
	await this.withDatabaseTransaction(async () => {

		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnBudget(this, budgetId);
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.UpdateBudget);

		const {rows: [prev]} = await this.parameterisedQuery`
			UPDATE budget_versions
			SET is_most_recent = false
			WHERE budget_id = ${budgetId} AND is_most_recent = true
			RETURNING *`;

		await this.parameterisedQuery`
			INSERT INTO budget_versions
				(budget_id, version_number, name, is_deleted, is_most_recent, changeset_id)
			VALUES
				(${budgetId}, ${prev.version_number + 1}, ${name}, false, true, ${changesetId})`;
	});
}

export async function deleteBudget(
	this: DbClient,
	{budgetId, userId}: IDeleteBudget
): Promise<void> {
	await this.withDatabaseTransaction(async () => {

		await this.assertUserCanDeleteBudget({userId, budgetId});
		await acquireLockOnBudget(this, budgetId);
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.DeleteBudget);

		const {rows: [prev]} = await this.parameterisedQuery`
			UPDATE budget_versions
			SET is_most_recent = false
			WHERE budget_id = ${budgetId} AND is_most_recent = true
			RETURNING *`;

		await this.parameterisedQuery`
			INSERT INTO budget_versions
				(budget_id, version_number, name, is_deleted, is_most_recent, changeset_id)
			VALUES (${budgetId}, ${prev.version_number + 1}, ${prev.name}, true, true, ${changesetId})`;
	});
}

export async function getBudgetById(
	this: DbClient,
	{userId, budgetId}: IBudgetUser
): Promise<IBudgetEntity | null> {
	await this.assertUserCanReadBudget({userId, budgetId});
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT *
		FROM current_budgets
		WHERE budget_id = ${budgetId}`;
	return (rowCount === 0) ? null : getBudgetEntityFromDatabaseRow(rows[0]);
}

export async function getReadableBudgetsByUser(
	this: DbClient,
	{userId}: IUser
): Promise<IBudgetEntity[]> {
	const {rows} = await this.parameterisedQuery`
		SELECT *
		FROM 
			current_budgets b
			LEFT JOIN permissions p ON p.budget_id = b.id
		WHERE 
			p.user_id = ${userId} AND p.can_read = true`;
	return rows.map(getBudgetEntityFromDatabaseRow);
}


//// Helper functions

async function acquireLockOnBudget(client: DbClient, budgetId: string) {
	// Acquire a lock on the row representing the budget
	const {rowCount} = await client.parameterisedQuery`
		SELECT * FROM budgets WHERE id = ${budgetId} FOR UPDATE`;

	// Throw an error if the budget doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching budget');
	}
}

function getBudgetEntityFromDatabaseRow(row: IBudgetDatabaseRow): IBudgetEntity {
	return {
		budgetId: row.id,
		name: row.name,
		versionNumber: row.version_number,
		isDeleted: row.is_deleted,
		isMostRecent: row.is_most_recent,
		changesetId: row.changeset_id
	}
}
