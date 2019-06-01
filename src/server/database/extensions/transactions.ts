import * as _ from 'lodash';

import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {DbClient, IBudgetUser, IVersionedEntity} from '../DbClient';
import {createBudgetChangeset} from './changesets';
import {
	createPostingsForTransaction,
	deletePostingsForTransaction, getPostingsByTransactionId,
	ICreatePosting,
	IPostingEntity,
	IUpdatePosting,
	updatePostingsForTransaction
} from './postings';


//// Interfaces

interface ITransactionDatabaseRow {
	id: string;
	budget_id: string;
	date: Date;
	description: string;
	version_number: number;
	is_deleted: boolean;
	is_most_recent: boolean;
	changeset_id: string;
}

interface ITransactionPrimaryKey {
	transactionId: string;
}

interface ITransactionImmutable extends ITransactionPrimaryKey {
	budgetId: string;
}

interface ITransactionVersion<PostingType> extends  ITransactionPrimaryKey {
	date: Date;
	description: string;
	postings: PostingType[];
}

export interface ICreateTransaction extends IBudgetUser, ITransactionImmutable, ITransactionVersion<ICreatePosting> {}
export interface IUpdateTransaction extends IBudgetUser, ITransactionVersion<IUpdatePosting> {}
export interface IDeleteTransaction extends IBudgetUser, ITransactionPrimaryKey {}
export interface ITransactionEntity extends ITransactionImmutable, ITransactionVersion<IPostingEntity>, IVersionedEntity {}


//// Functions

export async function createTransaction(
	this: DbClient,
	{userId, budgetId, transactionId, date, description, postings}: ICreateTransaction
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await this.assertUserCanWriteToBudget({userId, budgetId});
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.CreateTransaction);

		await this.parameterisedQuery`
			INSERT INTO transactions
				(id, budget_id)
			VALUES
				(${transactionId}, ${budgetId})`;

		await this.parameterisedQuery`
			INSERT INTO transaction_versions
				(transaction_id, version_number, date, description, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${transactionId}, 0, ${date}, ${description}, true, false, ${changesetId})`;

		await createPostingsForTransaction(this, changesetId, transactionId, postings);
	});
}

export async function updateTransaction(
	this: DbClient,
	{userId, budgetId, transactionId, date, description, postings}: IUpdateTransaction
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnTransaction(this, transactionId);
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.UpdateTransaction);

		await this.parameterisedQuery`
			WITH prev AS (
				UPDATE transaction_versions
				SET is_most_recent = false
				WHERE transaction_id = ${transactionId} AND is_most_recent = true
				RETURNING prev
			)
			INSERT INTO transaction_versions
				(transaction_id, version_number, date, description, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${transactionId}, prev.version_number + 1, ${date}, ${description}, true, false, ${changesetId})`;

		await updatePostingsForTransaction(this, changesetId, transactionId, postings);
	});
}

export async function deleteTransaction(
	this: DbClient,
	{userId, budgetId, transactionId}: IDeleteTransaction
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnTransaction(this, transactionId);
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.DeleteTransaction);

		await this.parameterisedQuery`
			WITH prev AS (
				UPDATE transaction_versions
				SET is_most_recent = false
				WHERE transaction_id = ${transactionId} AND is_most_recent = true
				RETURNING *
			)
			INSERT INTO transaction_versions
				(transaction_id, version_number, date, description, is_most_recent, is_deleted, changeset_id)
			VALUES
				(${transactionId}, prev.version_number + 1, prev.date, prev.description, true, true, ${changesetId})`;

		await deletePostingsForTransaction(this, changesetId, transactionId);
	});
}

export async function getTransactionById(
	this: DbClient,
	{userId, budgetId, transactionId}: IBudgetUser & ITransactionPrimaryKey
): Promise<ITransactionEntity | null> {
	await this.assertUserCanReadBudget({userId, budgetId});

	const {rows} = await this.parameterisedQuery`
		SELECT *
		FROM current_transactions
		WHERE transactionId = ${transactionId}`;

	if (_.isEmpty(rows)) {
		return null;
	} else {
		return {
			...getTransactionEntityFromDatabaseRow(rows[0]),
			postings: await getPostingsByTransactionId(this, transactionId)
		};
	}
}


//// Helper functions

async function acquireLockOnTransaction(
	client: DbClient,
	transactionId: string
) {
	// Acquire a lock on the row representing the budget transaction
	const {rowCount} = await client.parameterisedQuery`
			SELECT * FROM transactions WHERE id = ${transactionId} FOR UPDATE`;

	// Throw an error if the user doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching budget transaction');
	}
}

function getTransactionEntityFromDatabaseRow(row: ITransactionDatabaseRow): Omit<ITransactionEntity, 'postings'> {
	return {
		transactionId: row.id,
		budgetId: row.budget_id,
		date: row.date,
		description: row.description,
		versionNumber: row.version_number,
		isDeleted: row.is_deleted,
		isMostRecent: row.is_most_recent,
		changesetId: row.changeset_id
	}
}
