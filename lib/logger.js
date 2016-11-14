/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

const path = require("path");
const winston = require("winston");
const fs = require("fs-extra");
const Bluebird = require("bluebird");

let Application = null;
const mkdirsAsync = Bluebird.promisify(fs.mkdirs);

/**
 * A class to perform rich logging, based on [Winston](http://npmjs.com/package/winston).
 *
 * @class Logger
 */
class Logger{
  /**
   * Creates a new logger.
   *
   * @param {string} target The target log file. It will be stored in the `log` folder with the current environment appended.
   * @param {boolean} [useConsole=false] Whether or not also log on console.
   * @param {any} [root=null] The root folder for the log file. Usually it's the `log` in the current working directory.
   *
   * @memberOf Logger
   */
  constructor(target, useConsole = false, root = null){
    // This is to resolve a cyclic dependency
    if(!Application)
      Application = require("./application"); // eslint-disable-line global-require

    this.root = path.resolve(root || Application.root, "log");
    this.target = target;
    this.useConsole = useConsole;
  }

  /**
   * Prepares the logger for use.
   *
   * @returns {Promise<winston.Logger>|Error} The current logger in case of success, the error otherwise.
   */
  async prepare(){
    if(this.backend)
      return Promise.resolve(this);

    await mkdirsAsync(this.root);

    const target = path.resolve(this.root, `${this.target}.log`);

    // Create transports
    const level = Application.debug ? "debug" : "verbose";
    const transports = [
      new winston.transports.File({name: "file", filename: target, level, stderrLevels: ["error"], colorize: true, timestamp: true})
    ];

    if(this.useConsole)
      transports.unshift(new winston.transports.Console({name: "console", level, stderrLevels: ["error"], colorize: true, timestamp: true}));

    // Create the logger
    this.backend = new winston.Logger({transports});
    Bluebird.promisifyAll(this.backend);
    return this;
  }

  /**
   * Logs a message with info priority level `info`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<winston.Logger>|Error} The backend in case of success, the error otherwise.
   */
  info(...args){
    return this.backend.infoAsync(...args);
  }

  /**
   * Logs a message with info priority level `warn`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<winston.Logger>|Error} The backend in case of success, the error otherwise.
   */

  warn(...args){
    return this.backend.warnAsync(...args);
  }

  /**
   * Logs a message with info priority level `error`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<winston.Logger>|Error} The backend in case of success, the error otherwise.
   */

  error(...args){
    return this.backend.errorAsync(...args);
  }

  /**
   * Logs a message with info priority level `fatal` and then quits the process.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<winston.Logger>|Error} The backend in case of success, the error otherwise.
   */

  fatal(...args){
    return this.backend.errorAsync(...args).then(() => process.exit(1)); // eslint-disable-line no-process-exit
  }

  /**
   * Logs a message with info priority level `debug`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<winston.Logger>|Error} The backend in case of success, the error otherwise.
   */
  debug(...args){
    if(!Application.debug)
      return Promise.resolve(this.backend);

    return this.backend.debugAsync(...args);
  }
}

module.exports = Logger;
