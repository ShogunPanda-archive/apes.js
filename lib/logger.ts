/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

import * as path from "path";
import * as winston from "winston";
import * as fs from "fs-extra";
import * as Bluebird from "bluebird";

import {Application} from "./application";

const mkdirsAsync = Bluebird.promisify(fs.mkdirs);

declare module "winston"{
  export interface LoggerInstance {
    infoAsync(...args: any[]): Promise<LoggerInstance>;
    warnAsync(...args: any[]): Promise<LoggerInstance>;
    errorAsync(...args: any[]): Promise<LoggerInstance>;
    debugAsync(...args: any[]): Promise<LoggerInstance>;
  }
}

/**
 * A class to perform rich logging.
 */
export class Logger{
  /**
   * The target log file. It will be stored in the `log` folder with the current environment appended.
   *
   * @type {string}
   */
  public target: string;

  /**
   * Whether or not also log on console.
   *
   * @type {boolean}
   */
  public useConsole: boolean;

  /**
   * The root folder for the log file. Usually it's the `log` in the current working directory.
   *
   * @type {string}
   */
  public root: string;

  /**
   * The logging backend.
   *
   * @type {winston.LoggerInstance}
   */
  public backend: winston.LoggerInstance;

  /**
   * Creates a new Logger.
   *
   * @param {string} target The target log file.
   * @param {boolean} useConsole Whether or not also log on console.
   */
  constructor(target: string, useConsole: boolean = false){
    this.root = path.resolve(Application.root, "log");
    this.target = target;
    this.useConsole = useConsole;
  }

  /**
   * Prepares the logger for use.
   *
   * @returns {Promise<Logger|Error>} The current logger in case of success, the error otherwise.
   */
  public async prepare(): Promise<Logger|Error>{
    if(this.backend)
      return Promise.resolve(this);

    try{
      await mkdirsAsync(this.root);

      const target: string = path.resolve(this.root, `${this.target}-${Application.environment}.log`);

      // Create transports
      const level: string = Application.debug ? "debug" : "verbose";
      const transports: winston.TransportInstance[] = [
        new winston.transports.File({name: "file", filename: target, level, stderrLevels: ["error"], colorize: true, timestamp: true})
      ];

      if(this.useConsole)
        transports.unshift(new winston.transports.Console({name: "console", level, stderrLevels: ["error"], colorize: true, timestamp: true}));

      // Create the logger
      this.backend = new winston.Logger({transports});
      Bluebird.promisifyAll(this.backend);
      return Promise.resolve(this);
    }catch(e){
      return Promise.reject(e);
    }
  }

  /**
   * Logs a message with info priority level `info`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
   */
  public info(...args: any[]): Promise<winston.LoggerInstance>{
    return this.backend.infoAsync(...args);
  }

  /**
   * Logs a message with info priority level `warn`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
   */
  public warn(...args: any[]): Promise<winston.LoggerInstance>{
    return this.backend.warnAsync(...args);
  }

  /**
   * Logs a message with info priority level `error`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
   */
  public error(...args: any[]): Promise<winston.LoggerInstance>{
    return this.backend.errorAsync(...args);
  }

  /**
   * Logs a message with info priority level `fatal` and then quits the process.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
   */
  public fatal(...args: any[]): Promise<void>{
    return this.backend.errorAsync(...args).then(() => process.exit(1));
  }

  /**
   * Logs a message with info priority level `debug`.
   *
   * @param {any[]} args The message to log.
   * @returns {Promise<LoggerInstance>} The backend in case of success, the error otherwise.
   */
  public debug(...args: any[]): Promise<winston.LoggerInstance>{
    if(!Application.debug)
      return Promise.resolve(this.backend);

    return this.backend.debugAsync(...args);
  }
}
