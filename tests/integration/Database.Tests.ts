import {expect} from 'chai';
import 'mocha';
import * as uuid from 'uuid';
import {Logger} from '../../src/common/util/Logger';

import {getRandomString} from '../util/getRandomString';
import {ManagementDb} from '../util/ManagementDb';
import {TestDb} from '../util/TestDb';

describe('Database tests', () => {
	let managementDb: ManagementDb;
	let testDb: TestDb;
	let userId: string;
	let budgetId: string;

	before(async () => {
		const testDbName = `budget_test_${getRandomString(10)}`;
		Logger.log(`Test database: ${testDbName}\n`);

		managementDb = new ManagementDb();
		testDb = await managementDb.createDatabase(testDbName);
		await testDb.createDatabaseTables();
	});

	beforeEach(async () => {
		await testDb.withClient(async client => {
			const planId = uuid.v4();
			await client.createPlan({
				planId,
				name: 'default-plan',
				cost: 0
			});

			userId = uuid.v4();
			budgetId = uuid.v4();
			await client.createUser({
				userId,
				fullName: 'Joe Bloggs',
				displayName: 'Joe',
				email: 'joe@example.com',
				plan: planId,
			});
			await client.createBudget({
				budgetId,
				userId,
				name: 'primary budget'
			});
		});
	});

	after(async () => {
		await managementDb.destroyDatabase(testDb);
		await managementDb.disconnect();
	});

	it('Can read the current state of a budget', async () => {
		await testDb.withClient(async client => {
			const budgetEntity = await client.getBudgetById({userId, budgetId});
			Logger.log('budget:', budgetEntity);
		});
	});

	it('Can update a budget', async () => {
		await testDb.withClient(async client => {
			await client.updateBudget({
				budgetId,
				userId,
				name: 'new-name'
			});
		});
	});
});
