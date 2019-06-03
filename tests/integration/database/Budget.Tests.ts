import {expect} from 'chai';
import 'mocha';
import * as uuid from 'uuid';
import {Logger} from '../../../src/common/util/Logger';
import {expectToReject} from '../../util/expectToThrow';

import {getRandomString} from '../../util/getRandomString';
import {ManagementDb} from '../../util/ManagementDb';
import {TestDb} from '../../util/TestDb';

describe('Database budget tests', () => {
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

	it('The user who created a budget can read its\'t current state', async () => {
		await testDb.withClient(async client => {
			const budgetEntity = await client.getBudgetById({userId: primaryUserId, budgetId: primaryBudgetId});
			Logger.log('budget:', budgetEntity);
		});
	});

	it('A separate user with no granted permissions cannot read the current state of a budget', async () => {
		const otherUserId = uuid.v4();
		await testDb.withClient(async client => {
			await client.createUser({
				userId: otherUserId,
				fullName: 'Joe Bloggs',
				displayName: 'Joe',
				email: 'joe@example.com',
				plan: primaryPlanId,
			});

			await expectToReject(async () => {
				await client.getBudgetById({
					userId: otherUserId,
					budgetId: primaryBudgetId
				});
			});
		});
	});

	it('The user who created a budget can grant permissions to other users', async () => {
		const otherUserId = uuid.v4();
		await testDb.withClient(async client => {
			await client.createUser({
				userId: otherUserId,
				fullName: 'Joe Bloggs',
				displayName: 'Joe',
				email: 'joe@example.com',
				plan: primaryPlanId,
			});
			await client.setPermissions(primaryUserId, {
				userId: otherUserId,
				budgetId: primaryBudgetId,
				canDelete: false,
				canShare: false,
				canWrite: true,
				canRead: true
			});
			const budgetEntity = await client.getBudgetById({userId: otherUserId, budgetId: primaryBudgetId});
			Logger.log('budget:', budgetEntity);
		});
	});

	it('Can update a budget', async () => {
		await testDb.withClient(async client => {
			await client.updateBudget({
				budgetId: primaryBudgetId,
				userId: primaryUserId,
				name: 'new-name'
			});
		});
	});

	it('Can delete a budget', async () => {
		await testDb.withClient(async client => {
			await client.deleteBudget({
				budgetId: primaryBudgetId,
				userId: primaryUserId
			});
		});
	});

	it('Cannot read a database after it has been deleted', async () => {
		await testDb.withClient(async client => {
			await client.deleteBudget({
				budgetId: primaryBudgetId,
				userId: primaryUserId
			});

			const budget = await client.getBudgetById({
				userId: primaryUserId,
				budgetId: primaryBudgetId
			});

			expect(budget).to.equal(null);
		});
	});
});
