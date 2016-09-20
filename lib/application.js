/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const path = require("path");
const logger_1 = require("./logger");
/**
 * A boilerplate for Node.js applications.
 */
class Application {
    /**
     * Creates a new application.
     *
     * @param {string} configurationPath The configuration file path.
     */
    constructor(configurationPath = "config/application") {
        this.configurationPath = path.resolve(Application.root, configurationPath);
        this.logger = new logger_1.default(`${Application.environment}-main`, true);
    }
    /**
     * Performs the main application loop.
     *
     * @returns {Promise<void | Error>} Nothing in case of success, the error otherwise.
     */
    run() {
        return __awaiter(this, void 0, void 0, function* () {
            let error = null;
            try {
                yield this.logger.prepare();
            }
            catch (e) {
                console.error(`Cannot create the logger: ${e}. Exiting ...`);
                process.exit(1);
                return Promise.reject(e);
            }
            try {
                // Prepare the application
                yield this.loadConfiguration();
                yield this.prepare();
                // Execute
                yield this.logger.info(`Process ${Application.processName} started as PID ${process.pid} ...`);
                yield this.execute();
                // Cleanup
                yield this.logger.info("All operations completed. Exiting ...");
                yield this.cleanup();
                return Promise.resolve();
            }
            catch (e) {
                error = e;
                yield this.logger.fatal(e);
                return Promise.reject(error);
            }
            finally {
                try {
                    yield this.cleanup();
                }
                catch (e) {
                }
                yield (error ? this.logger.warn("Process exited with errors.") : this.logger.info("Process exited without errors."));
                process.exit(error ? 1 : 0);
            }
        });
    }
    /**
     * Loads and parses the configuration file.
     *
     * @returns {Promise<any | Error>} The configuration in case of success, the error otherwise.
     */
    loadConfiguration() {
        try {
            // Load configuration and port
            this.configuration = require(this.configurationPath)[Application.environment] || {}; // tslint:disable-line:no-require-imports
            return Promise.resolve(this.configuration);
        }
        catch (e) {
            return Promise.reject(e);
        }
    }
    /**
     * Prepares the application for execution. This **MUST** be overriden by subclasses.
     *
     * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
     */
    prepare() {
        return this.logger.warn(`${this.constructor.name}.prepare should override Application.prepare.`);
    }
    /**
     * **THIS IS WHERE APPLICATION LOGIC MUST BE PUT.**
     *
     * Executes the application. This **MUST** be overriden by subclasses.
     *
     * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
     */
    execute() {
        return this.logger.warn(`${this.constructor.name}.execute should override Application.execute.`);
    }
    /**
     * Cleans up the application after the execution. This **MUST** be overriden by subclasses.
     *
     * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
     */
    cleanup() {
        return this.logger.warn(`${this.constructor.name}.cleanup should override Application.cleanup.`);
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A boilerplate for Node.js applications.
 */
exports.default = Application;
/**
 * The base path for all I/O.
 *
 * @type {string}
 */
Application.root = path.resolve(path.dirname(require.main.filename), ".");
/**
 * The current process name.
 *
 * @type {string}
 */
Application.processName = process.env.PROCESS_NAME || path.basename(process.argv[1]);
/**
 * The current environment. Defaults to `development`.
 *
 * @type {string}
 */
Application.environment = process.env.NODE_ENV || "development";
/**
 * If the process is running in production mode.
 *
 * @type {boolean}
 */
Application.production = process.env.NODE_ENV === "production";
/**
 * If debug is enabled.
 *
 * @type {boolean}
 */
Application.debug = process.env.NODE_DEBUG && process.env.NODE_DEBUG.indexOf("apes") !== -1;
//# sourceMappingURL=application.js.map