require('reflect-metadata');
import main from './main';

main().catch((e: any) => {
	process.nextTick(() => {
		throw e;
	});
});
