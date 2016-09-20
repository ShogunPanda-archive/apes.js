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
const winston = require("winston");
const fs = require("fs-extra");
const Bluebird = require("bluebird");
const application_1 = require("./application");
const mkdirsAsync = Bluebird.promisify(fs.mkdirs);
/**
 * A class to perform rich logging.
 */
class Logger {
    /**
     * Creates a new Logger.
     *
     * @param {string} target The target log file.
     * @param {boolean} useConsole Whether or not also log on console.
     */
    constructor(target, useConsole = false) {
        this.root = path.resolve(application_1.default.root, "log");
        this.target = target;
        this.useConsole = useConsole;
    }
    /**
     * Prepares the logger for use.
     *
     * @returns {Promise<Logger|Error>} The current logger in case of success, the error otherwise.
     */
    prepare() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.backend)
                return Promise.resolve(this);
            try {
                yield mkdirsAsync(this.root);
                const target = path.resolve(this.root, `${this.target}-${application_1.default.environment}.log`);
                // Create transports
                const level = application_1.default.debug ? "debug" : "verbose";
                const transports = [
                    new winston.transports.File({ name: "file", filename: target, level, stderrLevels: ["error"], colorize: true, timestamp: true })
                ];
                if (this.useConsole)
                    transports.unshift(new winston.transports.Console({ name: "console", level, stderrLevels: ["error"], colorize: true, timestamp: true }));
                // Create the logger
                this.backend = new winston.Logger({ transports });
                Bluebird.promisifyAll(this.backend);
                return Promise.resolve(this);
            }
            catch (e) {
                return Promise.reject(e);
            }
        });
    }
    /**
     * Logs a message with info priority level `info`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    info(...args) {
        return this.backend.infoAsync(...args);
    }
    /**
     * Logs a message with info priority level `warn`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    warn(...args) {
        return this.backend.warnAsync(...args);
    }
    /**
     * Logs a message with info priority level `error`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    error(...args) {
        return this.backend.errorAsync(...args);
    }
    /**
     * Logs a message with info priority level `fatal` and then quits the process.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    fatal(...args) {
        return this.backend.errorAsync(...args).then(() => process.exit(1));
    }
    /**
     * Logs a message with info priority level `debug`.
     *
     * @param {any[]} args The message to log.
     * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
     */
    debug(...args) {
        if (!application_1.default.debug)
            return Promise.resolve(this.backend);
        return this.backend.debugAsync(...args);
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * A class to perform rich logging.
 */
exports.default = Logger;
