import {Db} from '../../src/server/database/Db';
import {TestDb} from './TestDb';

export class ManagementDb extends Db {
	constructor() {
		super('postgres');
	}

	public async createDatabase(name: string): Promise<TestDb> {
		await this.withClient(async client => {
			await client.literalQuery `CREATE DATABASE ${name}`;
		});
		return new TestDb(name);
	}

	public async destroyDatabase(db: Db): Promise<void> {
		await db.disconnect();
		await this.withClient(async client => {
			await client.literalQuery `DROP DATABASE ${db.name}`;
		});
	}

}
