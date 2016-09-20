import * as winston from "winston";
import { Logger } from "./logger";
/**
 * A boilerplate for Node.js applications.
 */
export declare class Application {
    /**
     * The base path for all I/O.
     *
     * @type {string}
     */
    static root: string;
    /**
     * The current process name.
     *
     * @type {string}
     */
    static processName: string;
    /**
     * The current environment. Defaults to `development`.
     *
     * @type {string}
     */
    static environment: string;
    /**
     * If the process is running in production mode.
     *
     * @type {boolean}
     */
    static production: boolean;
    /**
     * If debug is enabled.
     *
     * @type {boolean}
     */
    static debug: boolean;
    /**
     * The current configuration.
     *
     * @type {any}
     */
    configuration: any;
    /**
     * The current configuration file path.
     *
     * @type {object}
     */
    configurationPath: string;
    /**
     * The current logger.
     *
     * @type {Logger}
     */
    logger: Logger;
    /**
     * Creates a new application.
     *
     * @param {string} configurationPath The configuration file path.
     */
    constructor(configurationPath?: string);
    /**
     * Performs the main application loop.
     *
     * @returns {Promise<void | Error>} Nothing in case of success, the error otherwise.
     */
    run(): Promise<void | Error>;
    /**
     * Loads and parses the configuration file.
     *
     * @returns {Promise<any | Error>} The configuration in case of success, the error otherwise.
     */
    loadConfiguration(): Promise<any | Error>;
    /**
     * Prepares the application for execution. This **MUST** be overriden by subclasses.
     *
     * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
     */
    protected prepare(): Promise<winston.LoggerInstance | Error | void>;
    /**
     * **THIS IS WHERE APPLICATION LOGIC MUST BE PUT.**
     *
     * Executes the application. This **MUST** be overriden by subclasses.
     *
     * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
     */
    protected execute(): Promise<winston.LoggerInstance | Error | void>;
    /**
     * Cleans up the application after the execution. This **MUST** be overriden by subclasses.
     *
     * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
     */
    protected cleanup(): Promise<winston.LoggerInstance | Error | void>;
}
