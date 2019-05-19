import express from 'express';
import {createConnection} from 'typeorm';

import * as config from './config.json';
import {apiRouter} from './router/api';

export default async function main(): Promise<void> {
	await createConnection();

	const app = express();
	app.use((req, res, next) => {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Credentials', 'true');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
		res.setHeader('Access-Control-Allow-Headers', 'DNT,X-CustomHeader,Keep-Alive,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type');
		next();
	});
	app.use('/api', apiRouter);

	app.listen(config.api.port);
	console.log(`listening on port ${config.api.port}`);
}
