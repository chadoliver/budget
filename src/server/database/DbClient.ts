import * as fs from 'fs-extra';
import * as _ from 'lodash';
import {PoolClient, QueryResult} from 'pg';
import {
	getPermissionsByUserAndBudget,
	setPermissions,
	assertUserCanDeleteBudget,
	assertUserCanReadBudget,
	assertUserCanShareBudget,
	assertUserCanWriteToBudget
} from './extensions/permissions';
import {createBudget, deleteBudget, getBudgetById, getReadableBudgetsByUser, updateBudget} from './extensions/budgets';
import {createChildNode, createRootNode, deleteNode, getNodeById, getNodesForBudget, getRootNode, updateNode} from './extensions/nodes';
import {createPlan, readPlanById} from './extensions/plans';
import {
	createTransaction,
	deleteTransaction,
	getTransactionById,
	updateTransaction
} from './extensions/transactions';
import {createUser, deleteUser, updateUser} from './extensions/users';
import {Logger} from '../../common/util/Logger';

export interface IUser {
	userId: string;
}

export interface IBudgetUser extends IUser {
	budgetId: string;
}

export interface IVersionedEntity {
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
	public readPlanById = readPlanById;

	public setPermissions = setPermissions;
	public getPermissionsByUserAndBudget = getPermissionsByUserAndBudget;
	public assertUserCanReadBudget = assertUserCanReadBudget;
	public assertUserCanWriteToBudget = assertUserCanWriteToBudget;
	public assertUserCanShareBudget = assertUserCanShareBudget;
	public assertUserCanDeleteBudget = assertUserCanDeleteBudget;

	public createUser = createUser;
	public updateUser = updateUser;
	public deleteUser = deleteUser;

	public createBudget = createBudget;
	public updateBudget = updateBudget;
	public deleteBudget = deleteBudget;
	public getBudgetById = getBudgetById;
	public getReadableBudgetsByUser = getReadableBudgetsByUser;

	public createRootNode = createRootNode;
	public createChildNode = createChildNode;
	public updateNode = updateNode;
	public deleteNode = deleteNode;
	public getNodeById = getNodeById;
	public getNodesForBudget = getNodesForBudget;
	public getRootNode = getRootNode;

	public createTransaction = createTransaction;
	public updateTransaction = updateTransaction;
	public deleteTransaction = deleteTransaction;
	public getTransactionById = getTransactionById;
}
