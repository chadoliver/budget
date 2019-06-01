import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {createBudgetChangeset} from './changesets';
import {DbClient, IBudgetUser} from '../DbClient';
import {
	createPostingsForTransaction,
	deletePostingsForTransaction, getPostingsByTransactionId,
	IPostingEntity,
	IPostingVersion,
	updatePostingsForTransaction
} from './postings';
import {
	createTransaction,
	deleteTransaction, getTransactionById,
	ITransactionEntity,
	ITransactionPrimaryKey,
	ITransactionVersion,
	updateTransaction
} from './transactions';


//// Interfaces

export interface ICreateTransactionAndPostings extends IBudgetUser {
	transaction: ITransactionVersion;
	postings: IPostingVersion[];
}

export interface IUpdateTransactionAndPostings extends IBudgetUser {
	transaction: ITransactionVersion,
	postings: IPostingVersion[];
}

export interface IDeleteTransactionAndPostings extends IBudgetUser {
	transaction: ITransactionPrimaryKey
}

export interface ITransactionAndPostingsEntity {
	transaction: ITransactionEntity;
	postings: IPostingEntity[];
}


//// Methods for the DbClient class

export async function createTransactionAndPostings(
	this: DbClient,
	{userId, budgetId, transaction, postings}: ICreateTransactionAndPostings
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await this.assertUserCanWriteToBudget({userId, budgetId});
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.CreateTransaction);

		await createTransaction(this, changesetId, {...transaction, budgetId});
		await createPostingsForTransaction(this, changesetId, transaction, postings);
	});
}

export async function updateTransactionAndPostings(
	this: DbClient,
	{userId, budgetId, transaction, postings}: IUpdateTransactionAndPostings
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnTransaction(this, transaction.transactionId);
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.UpdateTransaction);

		await updateTransaction(this, changesetId, transaction);
		await updatePostingsForTransaction(this, changesetId, transaction, postings);
	});
}

export async function deleteTransactionAndPostings(
	this: DbClient,
	{userId, budgetId, transaction}: IDeleteTransactionAndPostings
): Promise<void> {
	await this.withDatabaseTransaction(async () => {
		await this.assertUserCanWriteToBudget({userId, budgetId});
		await acquireLockOnTransaction(this, transaction.transactionId);
		const changesetId = await createBudgetChangeset(this, userId, budgetId, BudgetChangesetHint.DeleteTransaction);

		await deleteTransaction(this, changesetId, transaction);
		await deletePostingsForTransaction(this, changesetId, transaction);
	});
}

export async function getTransactionAndPostingsById(
	this: DbClient,
	{userId, budgetId, transactionId}: IBudgetUser & ITransactionPrimaryKey
): Promise<ITransactionAndPostingsEntity> {
	await this.assertUserCanReadBudget({userId, budgetId});
	return {
		transaction: await getTransactionById(this, transactionId),
		postings: await getPostingsByTransactionId(this, transactionId)
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
