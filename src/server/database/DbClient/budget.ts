import * as uuid from 'uuid';

import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {Domain} from '../../models/Domain';
import {Layer} from '../../models/Layer';
import {createBudgetChangeset} from './changesets';
import {DbClient, IBudgetChangeset, IReadVersioned} from '.';

export interface IPermission {
	userId: string;
	budgetId: string,
	canDelete: boolean,
	canShare: boolean,
	canWrite: boolean,
	canRead: boolean,
}

interface IBudgetId {
	budgetId: string;
}

interface IBudgetImmutable extends IBudgetId {}

interface IBudgetVersion extends IBudgetId {
	name: string;
}

export interface ICreateBudget extends IBudgetImmutable, IBudgetVersion, IBudgetChangeset {}

export interface IUpdateBudget extends IBudgetVersion, IBudgetChangeset {}

export interface IDeleteBudget extends IBudgetId, IBudgetChangeset {}

export interface IReadBudget extends IBudgetVersion, IReadVersioned {}

export async function setPermissions(
	this: DbClient,
	{userId, budgetId, canDelete, canShare, canWrite, canRead}: IPermission
): Promise<void> {
	await this.parameterisedQuery`
		INSERT INTO permissions
			(user_id, budget_id, can_delete, can_share, can_write, can_read)
		VALUES
			(${userId}, ${budgetId}, ${canDelete}, ${canShare}, ${canWrite}, ${canRead})
		ON CONFLICT (user_id, budget_id)
			DO UPDATE
			SET can_delete = ${canDelete}, can_share = ${canShare}, can_write = ${canWrite}, can_read = ${canRead}`;
}

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

		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.CreateBudget);
		await this.setPermissions({
			budgetId,
			userId,
			canDelete: true,
			canShare: true,
			canWrite: true,
			canRead: true,
		});

		await this.parameterisedQuery`
			INSERT INTO budget_versions
				(budget_id, version_number, name, is_deleted, is_most_recent, changeset_id)
			VALUES
				(${budgetId}, 0, ${name}, false, true, ${changesetId})`;

		const internalLocationId = uuid.v4();
		const internalPurposeId = uuid.v4();
		const externalLocationId = uuid.v4();
		const externalPurposeId = uuid.v4();

		await this.parameterisedQuery`
			INSERT INTO nodes
				(id, budget_id, path)
			VALUES
				(${internalLocationId}, ${budgetId}, ''),
				(${internalPurposeId}, ${budgetId}, ''),
				(${externalLocationId}, ${budgetId}, ''),
				(${externalPurposeId}, ${budgetId}, '')`;

		await this.parameterisedQuery`
			INSERT INTO node_versions
				(node_id, version_number,  name, opening_date, closing_date, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${internalLocationId}, 1, 'Internal Location', NOW(), NULL, true, false, ${changesetId}),
				(${internalPurposeId}, 1, 'Internal Purpose', NOW(), NULL, true, false, ${changesetId}),
				(${externalLocationId}, 1, 'External Location', NOW(), NULL, true, false, ${changesetId}),
				(${externalPurposeId}, 1, 'External Purpose', NOW(), NULL, true, false, ${changesetId})`;

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
		await acquireLockOnBudget.call(this, budgetId);
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.UpdateBudget);
		await this.parameterisedQuery`
			WITH prev AS (
				UPDATE budget_versions
				SET is_most_recent = false
				WHERE budget_id = ${budgetId} AND is_most_recent = true
				RETURNING *
			)
			INSERT INTO budget_versions
				(budget_id, version_number, name, is_deleted, is_most_recent, changeset_id)
			VALUES
				(${budgetId}, prev.version_number + 1, ${name}, false, true, ${changesetId})`;
	});
}

export async function deleteBudget(
	this: DbClient,
	{budgetId, userId}: IDeleteBudget
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnBudget.call(this, budgetId);
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.DeleteBudget);
		await this.parameterisedQuery`
			WITH prev AS (
				UPDATE budget_versions
				SET is_most_recent = false
				WHERE budget_id = ${budgetId} AND is_most_recent = true
				RETURNING *
			)
			INSERT INTO budget_versions
				(budget_id, version_number, name, is_deleted, is_most_recent, changeset_id)
			VALUES
				(${budgetId}, prev.version_number + 1, prev.name, true, true, ${changesetId})`;
	});
}

export async function getBudgetById(
	this: DbClient,
	{budgetId}: IBudgetId
): Promise<any | null> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT *
		FROM current_budgets
		WHERE id = ${budgetId}`;
	return (rowCount > 1) ? rows[0] : null;
}

async function acquireLockOnBudget(this: DbClient, budgetId: string) {
	// Acquire a lock on the row representing the budget
	const {rowCount} = await this.parameterisedQuery`
			SELECT * FROM budgets WHERE id = ${budgetId} FOR UPDATE`;

	// Throw an error if the budget doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching budget');
	}
}
