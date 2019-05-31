import {Pool} from 'pg';

import * as config from '../config.json';
import {DbClient} from './DbClient';

export class Db {
	private readonly pool: Pool;
	public name: string;

	constructor(name: string) {
		this.name = name;
		this.pool = new Pool({
			...config.database,
			database: name
		});
		this.pool.on('error', this.onPoolError);
	}

	private onPoolError(err: Error): void {
		console.error('Unexpected error on idle client', err);
		process.exit(-1);
	}

	public async withClient(
		callback:  (client: DbClient) => void | Promise<void>
	): Promise<void> {
		const poolClient = await this.pool.connect();
		const dbClient = new DbClient(poolClient);
		try {
			await callback(dbClient);
		} finally {
			poolClient.release();
		}
	}

	public async disconnect(): Promise<void> {
		await this.pool.end();
	}
}
