import * as _ from 'lodash';

import {DbClient, IVersionedEntity} from '../DbClient';
import {IBudgetEntity} from './budgets';


//// Interfaces

interface IPostingDatabaseRow {
	id: string;
	transaction_id: string;
	node_id: string;
	amount: number;
	description: string;
	version_number: number;
	is_deleted: boolean;
	is_most_recent: boolean;
	changeset_id: string;
}

interface IPostingPrimaryKey {
	postingId: string;
}

interface IPostingImmutable extends IPostingPrimaryKey {
	transactionId: string;
}

interface IPostingVersion extends  IPostingPrimaryKey {
	nodeId: string;
	amount: number;
	description: string;
}

export interface ICreatePosting extends IPostingImmutable, IPostingVersion {}
export interface IUpdatePosting extends IPostingVersion {}
export interface IDeletePosting extends IPostingPrimaryKey {}
export interface IPostingEntity extends IPostingImmutable, IPostingVersion, IVersionedEntity {}


//// Exported functions

export async function createPostingsForTransaction(
	client: DbClient,
	changesetId: string,
	transactionId: string,
	postings: IPostingVersion[]
): Promise<void> {
	for (const posting of postings) {
		await createPosting(client, changesetId, {...posting, transactionId});
	}
}

export async function updatePostingsForTransaction(
	client: DbClient,
	changesetId: string,
	transactionId: string,
	newPostings: IPostingVersion[]
): Promise<void> {
	const oldPostings = await getPostingsByTransactionId(client, transactionId);

	// Delete the postings that exist in the database but aren't part of the updated set of postings
	for (const posting of _.difference(oldPostings, newPostings)) {
		await deletePosting(client, changesetId, posting);
	}

	// Create the postings that are part of the updated set of postings but don't exist in the database
	for (const posting of _.difference(newPostings, oldPostings)) {
		await createPosting(client, changesetId, {...posting, transactionId});
	}

	// Update the postings that are in the updated set of postings and already exist int he database
	for (const posting of _.intersection(newPostings, oldPostings)) {
		await updatePosting(client, changesetId, posting);
	}
}

export async function deletePostingsForTransaction(
	client: DbClient,
	changesetId: string,
	transactionId: string
): Promise<void> {
	const currentPostings = await getPostingsByTransactionId(client, transactionId);
	for (const posting of currentPostings) {
		await deletePosting(client, changesetId, posting);
	}
}

export async function getPostingsByTransactionId(
	client: DbClient,
	transactionId: string
): Promise<IPostingEntity[]> {
	const {rows} = await client.parameterisedQuery`
		SELECT *
		FROM current_postings
		WHERE transactionId = ${transactionId}`;
	return rows.map(getPostingEntityFromDatabaseRow);
}


//// Helper functions

export async function createPosting(
	client: DbClient,
	changesetId: string,
	{postingId, transactionId, nodeId, amount, description}: ICreatePosting,
): Promise<void> {

	await client.parameterisedQuery`
		INSERT INTO postings
			(id, transaction_id)
		VALUES
			(${postingId}, ${transactionId})`;

	await client.parameterisedQuery`
		INSERT INTO posting_versions
			(posting_id, version_number, node_id, amount, description, is_most_recent, is_deleted, changeset_id)
		VALUES
			(${postingId}, 0, ${nodeId}, ${amount}, ${description}, true, false, ${changesetId})`;
}

export async function updatePosting(
	client: DbClient,
	changesetId: string,
	{postingId, nodeId, amount, description}: IUpdatePosting,
): Promise<void> {
	await client.parameterisedQuery`
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

export async function deletePosting(
	client: DbClient,
	changesetId: string,
	{postingId}: IDeletePosting
): Promise<void> {
	await client.parameterisedQuery`
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

function getPostingEntityFromDatabaseRow(row: IPostingDatabaseRow): IPostingEntity {
	return {
		postingId: row.id,
		transactionId: row.transaction_id,
		nodeId: row.node_id,
		amount: row.amount,
		description: row.description,
		versionNumber: row.version_number,
		isDeleted: row.is_deleted,
		isMostRecent: row.is_most_recent,
		changesetId: row.changeset_id
	}
}
