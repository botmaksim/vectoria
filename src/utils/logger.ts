/**
 * @file logger.ts
 * @brief Core logging mechanism for the Geomos application.
 * @details Provides strictly formal and structured logging methods. All logs are output in English.
 */

/**
 * @enum LogLevel
 * @brief Represents the severity level of a log message.
 */
export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

/**
 * @class Logger
 * @brief Static utility class for centralized application logging.
 */
export class Logger {
    /** @brief The current minimum log level required for a message to be output. */
    private static currentLevel: LogLevel = LogLevel.DEBUG;

    /**
     * @brief Sets the minimum log level.
     * @param level The required LogLevel.
     */
    static setLevel(level: LogLevel): void {
        this.currentLevel = level;
    }

    /**
     * @brief Formats and outputs a log message to the console.
     * @param level The severity of the log.
     * @param context The subsystem or module originating the log.
     * @param message The formal message to record.
     * @param data Optional additional data to log.
     */
    private static log(level: LogLevel, context: string, message: string, data?: any): void {
        if (level < this.currentLevel) return;

        const timestamp = new Date().toISOString();
        const levelString = LogLevel[level].padEnd(5, ' ');
        const prefix = `[${timestamp}] [${levelString}] [${context}]`;

        switch (level) {
            case LogLevel.DEBUG:
                console.debug(`${prefix} ${message}`, data !== undefined ? data : '');
                break;
            case LogLevel.INFO:
                console.info(`${prefix} ${message}`, data !== undefined ? data : '');
                break;
            case LogLevel.WARN:
                console.warn(`${prefix} ${message}`, data !== undefined ? data : '');
                break;
            case LogLevel.ERROR:
                console.error(`${prefix} ${message}`, data !== undefined ? data : '');
                break;
        }
    }

    /**
     * @brief Logs a debug message.
     * @param context The subsystem or module context.
     * @param message The formal debug message.
     * @param data Optional data.
     */
    static debug(context: string, message: string, data?: any): void {
        this.log(LogLevel.DEBUG, context, message, data);
    }

    /**
     * @brief Logs an informational message.
     * @param context The subsystem or module context.
     * @param message The formal informational message.
     * @param data Optional data.
     */
    static info(context: string, message: string, data?: any): void {
        this.log(LogLevel.INFO, context, message, data);
    }

    /**
     * @brief Logs a warning message.
     * @param context The subsystem or module context.
     * @param message The formal warning message.
     * @param data Optional data.
     */
    static warn(context: string, message: string, data?: any): void {
        this.log(LogLevel.WARN, context, message, data);
    }

    /**
     * @brief Logs an error message.
     * @param context The subsystem or module context.
     * @param message The formal error message.
     * @param data Optional data.
     */
    static error(context: string, message: string, data?: any): void {
        this.log(LogLevel.ERROR, context, message, data);
    }
}
