import {QueryResult} from 'pg';
import * as uuid from 'uuid';

import {UserChangesetHint} from '../../models/UserChangesetHint';
import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {DbClient} from '../DbClient';

export async function createUserChangeset(
	client: DbClient,
	userId: string,
	hint: UserChangesetHint,
): Promise<string> {
	const changesetId = uuid.v4();
	await client.parameterisedQuery`
		INSERT INTO user_changesets(id, user_id, hint)
		VALUES(${changesetId}, ${userId}, ${hint})`;

	return changesetId;
}

export async function createBudgetChangeset(
	client: DbClient,
	userId: string,
	budgetId: string,
	hint: BudgetChangesetHint,
): Promise<string> {
	const changesetId = uuid.v4();
	await client.parameterisedQuery`
		INSERT INTO budget_changesets(id, user_id, budget_id, hint)
		VALUES(${changesetId}, ${userId}, ${budgetId}, ${hint})`;

	return changesetId;
}

export async function singleRow<T>(queryResult: QueryResult | Promise<QueryResult>): Promise<T> {
	const {rowCount, rows} = await queryResult;
	if (rowCount === 1) {
		return rows[0];
	} else {
		throw new Error(`Expected a single row, but got ${rowCount} rows instead`);
	}
}
