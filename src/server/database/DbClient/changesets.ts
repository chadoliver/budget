import * as uuid from 'uuid';

import {UserChangesetHint} from '../../models/UserChangesetHint';
import {BudgetChangesetHint} from '../../models/BudgetChangesetHint';
import {DbClient} from '.';

export async function createUserChangeset(
	this: DbClient,
	userId: string,
	hint: UserChangesetHint,
): Promise<string> {
	const changesetId = uuid.v4();
	await this.parameterisedQuery`
		INSERT INTO user_changesets(id, user_id, hint)
		VALUES(${changesetId}, ${userId}, ${hint})`;

	return changesetId;
}

export async function createBudgetChangeset(
	this: DbClient,
	userId: string,
	budgetId: string,
	hint: BudgetChangesetHint,
): Promise<string> {
	const changesetId = uuid.v4();
	await this.parameterisedQuery`
		INSERT INTO budget_changesets(id, user_id, budget_id, hint)
		VALUES(${changesetId}, ${userId}, ${budgetId}, ${hint})`;

	return changesetId;
}
