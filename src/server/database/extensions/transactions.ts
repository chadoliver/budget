import {DbClient, IVersionedEntity} from '../DbClient';


//// Interfaces

export interface ITransactionPrimaryKey {
	transactionId: string;
}

export interface ITransactionImmutable extends ITransactionPrimaryKey {
	budgetId: string;
}

export interface ITransactionVersion extends  ITransactionPrimaryKey {
	date: Date;
	description: string;
}

export interface ICreateTransaction extends ITransactionImmutable, ITransactionVersion {}
export interface IUpdateTransaction extends ITransactionVersion {}
export interface IDeleteTransaction extends ITransactionPrimaryKey {}
export interface ITransactionEntity extends ITransactionImmutable, ITransactionVersion, IVersionedEntity {}


//// Functions

export async function createTransaction(
	client: DbClient,
	changesetId: string,
	{transactionId, budgetId, date, description}: ICreateTransaction,
): Promise<void> {
	await client.parameterisedQuery`
		INSERT INTO transactions
			(id, budget_id)
		VALUES
			(${transactionId}, ${budgetId})`;

	await client.parameterisedQuery`
		INSERT INTO transaction_versions
			(transaction_id, version_number, date, description, is_most_recent, is_deleted, changeset_id)
		VALUES
			(${transactionId}, 0, ${date}, ${description}, true, false, ${changesetId})`;
}

export async function updateTransaction(
	client: DbClient,
	changesetId: string,
	{transactionId, date, description}: IUpdateTransaction
): Promise<void> {
	await client.parameterisedQuery`
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

export async function deleteTransaction(
	client: DbClient,
	changesetId: string,
	{transactionId}: IDeleteTransaction
): Promise<void> {
	await client.parameterisedQuery`
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

export async function getTransactionById(
	client: DbClient,
	transactionId: string
): Promise<ITransactionEntity> {
	const {rows, rowCount} = await client.parameterisedQuery`
		SELECT *
		FROM current_transactions
		WHERE id = ${transactionId}`;
	return (rowCount > 1) ? rows[0] : null;
}
