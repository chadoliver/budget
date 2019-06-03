import {Db} from '../../src/server/database/Db';

export class TestDb extends Db {

	public async createDatabaseTables(): Promise<void> {
		// Actually, we're doing more than just creating tables, but 'createDatabaseTables' is
		// a good way of communicating the sort of work we're doing.

		const paths = [
			'../../../src/sql/extensions.sql',
			'../../../src/sql/create_types.sql',
			'../../../src/sql/create_sequences.sql',
			'../../../src/sql/create_tables.sql',
			'../../../src/sql/create_views.sql'
		];

		await this.withClient(async client => {
			for (const path of paths) {
				await client.executeFile(path);
			}
		});
	}
}
