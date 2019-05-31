import {LogLevel} from '../enums/LogLevel';

export class Logger {

	private static get environmentLogLevel(): LogLevel {
		switch (process.env.LOG_LEVEL) {
			case 'Info':
				return LogLevel.Info;
			case 'Log':
				return LogLevel.Log;
			case 'Warning':
				return LogLevel.Warning;
			case 'Error':
				return LogLevel.Error;
			case 'Silent':
				return LogLevel.Silent;
			default:
				return LogLevel.Log;
		}
	}

	public static info(...args: any[]): void {
		if (this.environmentLogLevel <= LogLevel.Info) {
			console.log(...args);
		}
	}

	public static log(...args: any[]): void {
		if (this.environmentLogLevel <= LogLevel.Log) {
			console.log(...args);
		}
	}

	public static warning(...args: any[]): void {
		if (this.environmentLogLevel <= LogLevel.Warning) {
			console.warn(...args);
		}
	}

	public static error(...args: any[]): void {
		if (this.environmentLogLevel <= LogLevel.Error) {
			console.error(...args);
		}
	}
}
