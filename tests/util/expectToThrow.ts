
export function expectToThrow<T>(func: () => any): undefined | never {
	try {
		func();
		throw new Error('Expected a failure');
	} catch (err) {
		if (err.message === 'Expected a failure') {
			throw err;
		} else {
			// The expected error occurred.
			return undefined;
		}
	}
}

export async function expectToReject<T>(func: () => Promise<any>): Promise<undefined | never> {
	try {
		await func();
		throw new Error('Expected a failure');
	} catch (err) {
		if (err.message === 'Expected a failure') {
			throw err;
		} else {
			// The expected error occurred.
			return undefined;
		}
	}
}
