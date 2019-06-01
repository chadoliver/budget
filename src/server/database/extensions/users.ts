import {UserChangesetHint} from '../../models/UserChangesetHint';
import {IBudgetEntity} from './budgets';
import {createUserChangeset} from './changesets';
import {DbClient, IVersionedEntity} from '../DbClient';

//// Interfaces

interface IUserDatabaseRow {
	id: string;
	full_name: string;
	display_name: string;
	email: string;
	plan: string;
	version_number: number;
	is_deleted: boolean;
	is_most_recent: boolean;
	changeset_id: string;
}


interface IUserPrimaryKey {
	userId: string;
}

interface IUserImmutable extends IUserPrimaryKey {}

interface IUserVersion extends IUserPrimaryKey {
	fullName: string;
	displayName: string;
	email: string;
	plan: string;
}

export interface ICreateUser extends IUserImmutable, IUserVersion {}

export interface IUpdateUser extends IUserVersion {}

export interface IDeleteUser extends IUserPrimaryKey {}

export interface IUserEntity extends IUserImmutable, IUserVersion, IVersionedEntity {}


//// Methods for the DbClient class

export async function createUser(
	this: DbClient,
	{userId, fullName, displayName, email, plan}: ICreateUser
) {
	await this.withDatabaseTransaction(async () => {
		await this.parameterisedQuery`
				INSERT INTO users
					(id)
				VALUES
					(${userId})`;

		const changesetId = await createUserChangeset(this, userId, UserChangesetHint.CreateUser);

		await this.parameterisedQuery`
				INSERT INTO user_versions
					(user_id, version_number, full_name, display_name, email, plan, is_most_recent, is_deleted, changeset_id)
				VALUES
					(${userId}, 0, ${fullName}, ${displayName}, ${email}, ${plan}, true, false, ${changesetId})`;
	});
}

export async function updateUser(
	this: DbClient,
	{userId, fullName, displayName, email, plan}: IUpdateUser
) {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnUser.call(this, userId);
		const changesetId = await createUserChangeset(this, userId, UserChangesetHint.UpdateUser);
		await this.parameterisedQuery`
			WITH prev AS (
				UPDATE user_versions
				SET is_most_recent = false
				WHERE user_id = id AND is_most_recent = true
				RETURNING *
			)
			INSERT INTO user_versions
				(user_id, version_number, full_name, display_name, email, plan, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${userId}, prev.version_number + 1, ${fullName}, ${displayName}, ${email}, ${plan}, true, false, ${changesetId})`;
	});
}

export async function deleteUser(
	this: DbClient,
	{userId}: IDeleteUser
) {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnUser.call(this, userId);
		const changesetId = await createUserChangeset(this, userId, UserChangesetHint.DeleteUser);
		await this.parameterisedQuery`
			WITH prev AS (
				UPDATE user_versions
				SET is_most_recent = false
				WHERE user_id = ${userId} AND is_most_recent = true
				RETURNING *
			)
			INSERT INTO user_versions
				(user_id, version_number, full_name, display_name, email, plan, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${userId}, prev.version_number + 1, prev.full_name, prev.display_name, prev.email, prev.plan, true, true, ${changesetId})`;
	});
}


//// Helper functions

async function acquireLockOnUser(this: DbClient, userId: string) {
	// Acquire a lock on the row representing the user
	const {rowCount} = await this.parameterisedQuery`
		SELECT * FROM users WHERE id = ${userId} FOR UPDATE`;

	// Throw an error if the user doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching user');
	}
}

function getUserEntityFromDatabaseRow(row: IUserDatabaseRow): IUserEntity {
	return {
		userId: row.id,
		fullName: row.full_name,
		displayName: row.display_name,
		email: row.email,
		plan: row.plan,
		versionNumber: row.version_number,
		isDeleted: row.is_deleted,
		isMostRecent: row.is_most_recent,
		changesetId: row.changeset_id
	}
}
