import * as fs from 'fs-extra';
import * as _ from 'lodash';
import {PoolClient, QueryResult} from 'pg';
import {LogLevel} from '../../../common/types/LogLevel';
import {createBudget, deleteBudget, getBudgetById, setPermissions, updateBudget} from './budget';
import {createNode, deleteNode, updateNode} from './node';
import {createPlan} from './plan';
import {createTransactionAndPostings, deleteTransactionAndPostings, updateTransactionAndPostings} from './transactionAndPostings';
import {createUser, deleteUser, updateUser} from './user';
import {Logger} from '../../../common/util/Logger';

export interface IBudgetChangeset {
	userId: string;
	budgetId: string;
}

export interface IReadVersioned {
	versionNumber: number;
	isDeleted: boolean;
	isMostRecent: boolean;
	changesetId: string;
}

export class DbClient {
	private readonly client: PoolClient;

	constructor(client: PoolClient) {
		this.client = client;
	}

	public async executeFile(path: string): Promise<void> {
		const file = await fs.readFile(path);
		try {
			await this.client.query(file.toString());
		} catch (error) {
			const description = `Failed to execute file at path:\n${path}\n`;
			Logger.error(description);
			throw error;
		}
	}

	public async literalQuery(templateStrings: TemplateStringsArray, ...values: any[]): Promise<QueryResult>{
		const text = values.reduce(
			(prev: any, cur: any, i: number) => prev + cur + templateStrings[i+1],
			templateStrings[0]
		);
		try {
			return await this.client.query(text);
		} catch (error) {
			const description = `Failed to execute query:\n${text.trim()}\n`;
			Logger.error(description);
			throw error;
		}
	}

	public async parameterisedQuery(templateStrings: TemplateStringsArray, ...values: any[]): Promise<QueryResult>{
		let text = templateStrings[0];
		for (let i = 1; i < templateStrings.length; i++) {
			text += `$${i}${templateStrings[i]}`;
		}

		try {
			return await this.client.query({text, values});
		} catch (error) {
			const formattedValues = values
				.map((value, index) => `\t${_.padEnd(`$${index + 1}:`, 5)}${value}\n`)
				.join('');
			const description = `Failed to execute query:${text}\nwith values:\n${formattedValues}\n`;
			Logger.error(description);
			throw error;
		}
	}

	public async withDatabaseTransaction(
		callback: () => void | Promise<void>,
	): Promise<void> {
		try {
			await this.literalQuery `BEGIN`;
			const result = await callback();
			await this.literalQuery `COMMIT`;
			return result;
		} catch (e) {
			await this.literalQuery `ROLLBACK`;
			throw e;
		}
	}

	public createPlan = createPlan;
	public setPermissions = setPermissions;

	public createUser = createUser;
	public updateUser = updateUser;
	public deleteUser = deleteUser;

	public createBudget = createBudget;
	public updateBudget = updateBudget;
	public deleteBudget = deleteBudget;
	public getBudgetById = getBudgetById;

	public createNode = createNode;
	public updateNode = updateNode;
	public deleteNode = deleteNode;

	public createTransactionAndPostings = createTransactionAndPostings;
	public updateTransactionAndPostings = updateTransactionAndPostings;
	public deleteTransactionAndPostings = deleteTransactionAndPostings;
}
