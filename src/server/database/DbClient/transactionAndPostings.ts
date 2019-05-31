import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {createBudgetChangeset} from './changesets';
import {DbClient, IBudgetChangeset} from '.';

export interface ITransactionVersion {
	transactionId: string;
	date: Date;
	description: string;
}

export interface IPosting {
	postingId: string;
	transactionId: string;
	nodeId: string;
	amount: number;
	description: string;
}

export interface ITransactionAndPostings extends IBudgetChangeset {
	transaction: ITransactionVersion;
	postings: IPosting[];
}

export async function createTransactionAndPostings(
	this: DbClient,
	{userId, budgetId, transaction, postings}: ITransactionAndPostings
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.CreateTransaction);
		await createTransaction.call(this, changesetId, budgetId, transaction);
		for (const posting of postings) {
			await createPosting.call(this, changesetId, transaction.transactionId, posting);
		}
	});
}

export async function updateTransactionAndPostings(
	this: DbClient,
	{userId, budgetId, transaction, postings}: ITransactionAndPostings
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnTransaction.call(this, transaction.transactionId);
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.UpdateTransaction);
		await updateTransaction.call(this, changesetId, transaction);
		for (const posting of postings) {
			await createPosting.call(this, changesetId, transaction.transactionId, posting);
		}
	});
}

export async function deleteTransactionAndPostings(
	this: DbClient,
	{userId, budgetId, transaction, postings}: ITransactionAndPostings
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await acquireLockOnTransaction.call(this, transaction.transactionId);
		const changesetId = await createBudgetChangeset.call(this, userId, budgetId, BudgetChangesetHint.DeleteTransaction);
		await deleteTransaction.call(this, changesetId, transaction);
		for (const posting of postings) {
			await deletePosting.call(this, changesetId, posting);
		}
	});
}

async function createTransaction(
	this: DbClient,
	changesetId: string,
	budgetId: string,
	{transactionId, date, description}: ITransactionVersion,
): Promise<void> {
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
}

async function updateTransaction(
	this: DbClient,
	changesetId: string,
	{transactionId, date, description}: ITransactionVersion
): Promise<void> {
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
}

async function deleteTransaction(
	this: DbClient,
	changesetId: string,
	{transactionId}: ITransactionVersion
): Promise<void> {
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
}

async function createPosting(
	this: DbClient,
	changesetId: string,
	transactionId: string,
	{postingId, nodeId, amount, description}: IPosting,
): Promise<void> {

	await this.parameterisedQuery`
		INSERT INTO postings
			(id, transaction_id)
		VALUES
			(${postingId}, ${transactionId})`;

	await this.parameterisedQuery`
		INSERT INTO posting_versions
			(posting_id, version_number, node_id, amount, description, is_most_recent, is_deleted, changeset_id)
		VALUES
			(${postingId}, 0, ${nodeId}, ${amount}, ${description}, true, false, ${changesetId})`;
}

async function updatePosting(
	this: DbClient,
	changesetId: string,
	{postingId, nodeId, amount, description}: IPosting,
): Promise<void> {
	await this.parameterisedQuery`
		WITH prev AS (
			UPDATE posting_versions
			SET is_most_recent = false
			WHERE posting_id = ${postingId} AND is_most_recent = true
			RETURNING *
		)
		INSERT INTO posting_versions
			(posting_id, version_number, node_id, amount, description, is_most_recent, is_deleted, changeset_id)
		VALUES
			(${postingId}, prev.version_number + 1, ${nodeId}, ${amount}, ${description}, true, false, ${changesetId})`;
}

async function deletePosting(
	this: DbClient,
	changesetId: string,
	{postingId}: IPosting
): Promise<void> {
	await this.parameterisedQuery`
		WITH prev AS (
			UPDATE posting_versions
			SET is_most_recent = false
			WHERE posting_id = ${postingId} AND is_most_recent = true
			RETURNING *
		)
		INSERT INTO posting_versions
			(posting_id, version_number, node_id, amount, description, is_most_recent, is_deleted, changeset_id)
		VALUES
			(${postingId}, prev.version_number + 1, prev.node_id, prev.amount, prev.description, true, true, ${changesetId})`;
}

async function acquireLockOnTransaction(this: DbClient, transactionId: string) {
	// Acquire a lock on the row representing the budget transaction
	const {rowCount} = await this.parameterisedQuery`
			SELECT * FROM transactions WHERE id = ${transactionId} FOR UPDATE`;

	// Throw an error if the user doesn't exist
	if (rowCount === 0) {
		throw new Error('Cannot find matching budget transaction');
	}
}
