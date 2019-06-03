import {expect} from 'chai';
import 'mocha';
import * as uuid from 'uuid';
import {Logger} from '../../../src/common/util/Logger';
import {Domain} from '../../../src/server/models/Domain';
import {Layer} from '../../../src/server/models/Layer';

import {getRandomString} from '../../util/getRandomString';
import {ManagementDb} from '../../util/ManagementDb';
import {TestDb} from '../../util/TestDb';

describe('Database node tests', () => {
	let managementDb: ManagementDb;
	let testDb: TestDb;
	let primaryPlanId: string;
	let primaryUserId: string;
	let primaryBudgetId: string;

	before(async () => {
		const testDbName = `budget_test_${getRandomString(10)}`;
		Logger.log(`Test database: ${testDbName}\n`);

		managementDb = new ManagementDb();
		testDb = await managementDb.createDatabase(testDbName);
		await testDb.createDatabaseTables();

		primaryPlanId = uuid.v4();
		await testDb.withClient(async client => {
			await client.createPlan({
				planId: primaryPlanId,
				name: 'default-plan',
				cost: 0
			});
		});
	});

	beforeEach(async () => {
		await testDb.withClient(async client => {
			primaryUserId = uuid.v4();
			primaryBudgetId = uuid.v4();
			await client.createUser({
				userId: primaryUserId,
				fullName: 'Joe Bloggs',
				displayName: 'Joe',
				email: 'joe@example.com',
				plan: primaryPlanId,
			});
			await client.createBudget({
				budgetId: primaryBudgetId,
				userId: primaryUserId,
				name: 'primary budget'
			});
		});
	});

	after(async () => {
		await managementDb.dropDatabase(testDb);
		await managementDb.disconnect();
	});

	it('The user who created a budget can read that budget\'s nodes', async () => {
		await testDb.withClient(async client => {
			const nodes = await client.getNodesForBudget({userId: primaryUserId, budgetId: primaryBudgetId});
			Logger.log('node rows:', nodes);
		});
	});

	it('Can get a specific root node by budget and role', async () => {
		await testDb.withClient(async client => {
			const node = await client.getRootNode({
				userId: primaryUserId,
				budgetId: primaryBudgetId,
				domain: Domain.Internal,
				layer: Layer.Purpose
			});

			Logger.log('root node:', node);
		});
	});
});
