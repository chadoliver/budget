require('reflect-metadata');
import main from './main';

main().catch((e: any) => {
	setImmediate(() => {
		throw e;
	});
});
