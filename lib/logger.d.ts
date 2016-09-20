import * as winston from "winston";
declare module "winston" {
    interface LoggerInstance {
        infoAsync(...args: any[]): Promise<LoggerInstance>;
        warnAsync(...args: any[]): Promise<LoggerInstance>;
        errorAsync(...args: any[]): Promise<LoggerInstance>;
        debugAsync(...args: any[]): Promise<LoggerInstance>;
    }
}
/**
 * A class to perform rich logging.
 */
export declare class Logger {
    /**
     * The target log file. It will be stored in the `log` folder with the current environment appended.
     *
     * @type {string}
     */
    target: string;
    /**
     * Whether or not also log on console.
     *
     * @type {boolean}
     */
    useConsole: boolean;
    /**
     * The root folder for the log file. Usually it's the `log` in the current working directory.
     *
     * @type {string}
     */
    root: string;
    /**
     * The logging backend.
     *
     * @type {winston.LoggerInstance}
     */
    backend: winston.LoggerInstance;
    /**
     * Creates a new Logger.
     *
     * @param {string} target The target log file.
     * @param {boolean} useConsole Whether or not also log on console.
     */
    constructor(target: string, useConsole?: boolean);
    /**
     * Prepares the logger for use.
     *
     * @returns {Promise<Logger|Error>} The current logger in case of success, the error otherwise.
     */
    prepare(): Promise<Logger | Error>;
    /**
     * Logs a message with info priority level `info`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    info(...args: any[]): Promise<winston.LoggerInstance>;
    /**
     * Logs a message with info priority level `warn`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    warn(...args: any[]): Promise<winston.LoggerInstance>;
    /**
     * Logs a message with info priority level `error`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    error(...args: any[]): Promise<winston.LoggerInstance>;
    /**
     * Logs a message with info priority level `fatal` and then quits the process.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    fatal(...args: any[]): Promise<void>;
    /**
     * Logs a message with info priority level `debug`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    debug(...args: any[]): Promise<winston.LoggerInstance>;
}
