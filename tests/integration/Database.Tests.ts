import {expect} from 'chai';
import 'mocha';
import * as uuid from 'uuid';
import {Logger} from '../../src/common/util/Logger';

import {Db} from '../../src/server/database/Db';
import {getRandomString} from '../util/getRandomString';

describe('Database tests', () => {
	let godDb: Db;
	let testDb: Db;
	let userId: string;
	let budgetId: string;

	before(async () => {
		const testDbName = `budget_test_${getRandomString(10)}`;
		console.log(`Test database: ${testDbName}\n`);

		godDb = new Db('postgres');
		await godDb.withClient(async client => {
			await client.literalQuery `CREATE DATABASE ${testDbName}`;
		});

		testDb = new Db(testDbName);
		await testDb.withClient(async client => {
			const paths = [
				'../../../src/sql/extensions.sql',
				'../../../src/sql/create_types.sql',
				'../../../src/sql/create_tables.sql',
				'../../../src/sql/create_views.sql'
			];

			for (const path of paths) {
				await client.executeFile(path);
			}
		});
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
		await testDb.disconnect();

		await godDb.withClient(async client => {
			await client.literalQuery `DROP DATABASE ${testDb.name}`;
		});
		await godDb.disconnect();
	});

	it('Can read the current state of a budget', async () => {
		await testDb.withClient(async client => {
			const budgetEntity = await client.getBudgetById({budgetId});
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
