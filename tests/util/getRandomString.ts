export function getRandomString(length: number = 10): string {
	const characters = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++ ) {
		result += characters.charAt(Math.floor(Math.random() * characters.length));
	}
	return result;
}