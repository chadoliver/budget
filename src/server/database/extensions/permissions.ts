import {DbClient} from '../DbClient';

//// Interfaces

interface IPermissionPrimaryKey {
	userId: string;
	budgetId: string,
}

export interface IPermissionEntity extends IPermissionPrimaryKey {
	canDelete: boolean,
	canShare: boolean,
	canWrite: boolean,
	canRead: boolean,
}


//// Methods for the DbClient class

export async function setPermissions(
	this: DbClient,
	sharingUserId: string,
	{userId: targetUserId, budgetId, canDelete, canShare, canWrite, canRead}: IPermissionEntity
): Promise<void> {
	await this.assertUserCanShareBudget({userId: sharingUserId, budgetId});
	await this.parameterisedQuery`
		INSERT INTO permissions
			(user_id, budget_id, can_delete, can_share, can_write, can_read)
		VALUES
			(${targetUserId}, ${budgetId}, ${canDelete}, ${canShare}, ${canWrite}, ${canRead})
		ON CONFLICT (user_id, budget_id)
			DO UPDATE
			SET can_delete = ${canDelete}, can_share = ${canShare}, can_write = ${canWrite}, can_read = ${canRead}`;
}

export async function getPermissionsByUserAndBudget(
	this: DbClient,
	{userId, budgetId}: IPermissionPrimaryKey
): Promise<IPermissionEntity> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT 
			budget_id AS "budgetId",
			user_id AS "userId",
			can_delete AS "canDelete",
			can_share AS "canShare",
			can_write AS "canWrite",
			can_read AS "canRead",
		FROM permissions
		WHERE userId = ${userId} AND budgetId = ${budgetId}`;
	return (rowCount > 1) ? rows[0] : null;
}

export async function assertUserCanReadBudget(
	this: DbClient,
	{userId, budgetId}: IPermissionPrimaryKey
): Promise<void> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT can_read
		FROM permissions
		WHERE userId = ${userId} AND budgetId = ${budgetId}`;

	if (rowCount === 0 || !rows[0].can_read) {
		throw new Error(`User ${userId} cannot read budget ${budgetId}`);
	}
}

export async function assertUserCanWriteToBudget(
	this: DbClient,
	{userId, budgetId}: IPermissionPrimaryKey
): Promise<void> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT can_write
		FROM permissions
		WHERE userId = ${userId} AND budgetId = ${budgetId}`;

	if (rowCount === 0 || !rows[0].can_write) {
		throw new Error(`User ${userId} cannot write to budget ${budgetId}`);
	}
}

export async function assertUserCanShareBudget(
	this: DbClient,
	{userId, budgetId}: IPermissionPrimaryKey
): Promise<void> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT can_share
		FROM permissions
		WHERE userId = ${userId} AND budgetId = ${budgetId}`;
	if (rowCount === 0 || !rows[0].can_share) {
		throw new Error(`User ${userId} cannot share budget ${budgetId}`);
	}
}

export async function assertUserCanDeleteBudget(
	this: DbClient,
	{userId, budgetId}: IPermissionPrimaryKey
): Promise<void> {
	const {rows, rowCount} = await this.parameterisedQuery`
		SELECT can_delete
		FROM permissions
		WHERE userId = ${userId} AND budgetId = ${budgetId}`;

	if (rowCount === 0 || !rows[0].can_delete) {
		throw new Error(`User ${userId} cannot delete budget ${budgetId}`);
	}
}
