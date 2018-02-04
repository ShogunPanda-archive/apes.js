/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
 */

const path = require("path");
const winston = require("winston");
const fs = require("fs-extra");
const Bluebird = require("bluebird");

const mkdirsAsync = Bluebird.promisify(fs.mkdirs);

/**
 * A module to perform rich logging, based on [Winston](http://npmjs.com/package/winston).
 *
 * @namespace Logger
 */
const Logger = {
  /**
   * Creates a new logger.
   *
   * @param {object} application A application object (created via {@link Application.create}) the new logger will belong to.
   * @param {string} target The target log file. It will be stored in the `log` folder with the current environment appended.
   * @param {boolean} [useConsole=false] Whether or not also log on console.
   * @param {string} [root=null] The root folder for the log file. Usually it's the `log` in the current working directory.
   * @returns {Promise<object>|Error} A new logger object in case of success, the error otherwise.
   */
  async create(application, target, useConsole = false, root = null){
    const rv = {};

    rv.application = application;
    rv.root = path.resolve(root || application.root, "log");
    rv.target = path.resolve(rv.root, `${target}.log`);
    rv.useConsole = useConsole;

    // Create directory
    await mkdirsAsync(rv.root);

    // Create transports
    const level = application.debug ? "debug" : "verbose";
    const transports = [
      rv.useConsole ? new winston.transports.Console({name: "console", level, stderrLevels: ["error"], colorize: true, timestamp: true}) : null,
      new winston.transports.File({name: "file", filename: rv.target, level, stderrLevels: ["error"], colorize: true, timestamp: true})
    ].filter(t => t);

    // Create the logger
    rv.backend = new winston.Logger({transports});
    Bluebird.promisifyAll(rv.backend);
    return rv;
  },

  /**
   * Logs a message with info priority level `info`.
   *
   * @param {object} logger A object created via {@link Logger.create}.
   * @param {any[]} args The message to log, followed by any additional properties.
   * @returns {Promise<winston.Logger|Error>} The winston backend success result or a error.
   */
  info(logger, ...args){
    return logger.backend.infoAsync(...args);
  },

  /**
   * Logs a message with info priority level `warn`.
   *
   * @param {object} logger A object created via {@link Logger.create}.
   * @param {any[]} args The message to log, followed by any additional properties.
   * @returns {Promise<winston.Logger|Error>} The winston backend success result or a error.
   */
  warn(logger, ...args){
    return logger.backend.warnAsync(...args);
  },

  /**
   * Logs a message with info priority level `error`.
   *
   * @param {object} logger A object created via {@link Logger.create}.
   * @param {any[]} args The message to log, followed by any additional properties.
   * @returns {Promise<winston.Logger|Error>} The winston backend success result or a error.
   */
  error(logger, ...args){
    return logger.backend.errorAsync(...args);
  },

  /**
   * Logs a message with info priority level `fatal` and then quits the process.
   *
   * @param {object} logger A object created via {@link Logger.create}.
   * @param {any[]} args The message to log, followed by any additional properties.
   * @returns {Promise<winston.Logger|Error>} The winston backend success result or a error.
   */
  fatal(logger, ...args){
    return logger.backend.errorAsync(...args).then(() => process.exit(1)); // eslint-disable-line no-process-exit
  },

  /**
   * Logs a message with info priority level `debug`.
   *
   * @param {object} logger A object created via {@link Logger.create}.
   * @param {any[]} args The message to log, followed by any additional properties.
   * @returns {Promise<winston.Logger|Error>} The winston backend success result or a error.
   */
  debug(logger, ...args){
    if(!logger.application.debug)
      return Promise.resolve(logger.backend);

    return logger.backend.debugAsync(...args);
  }
};

module.exports = Logger;
