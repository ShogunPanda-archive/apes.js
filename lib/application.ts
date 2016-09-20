/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

import * as path from "path";
import * as winston from "winston";

import Logger from "./logger";

/**
 * A boilerplate for Node.js applications.
 */
export default class Application{
  /**
   * The base path for all I/O.
   *
   * @type {string}
   */
  public static root: string = path.resolve(path.dirname(require.main.filename), ".");
  
  /**
   * The current process name.
   *
   * @type {string}
   */
  public static processName: string = process.env.PROCESS_NAME || path.basename(process.argv[1]);
  
  /**
   * The current environment. Defaults to `development`.
   *
   * @type {string}
   */
  public static environment: string = process.env.NODE_ENV || "development";
  
  /**
   * If the process is running in production mode.
   *
   * @type {boolean}
   */
  public static production: boolean = process.env.NODE_ENV === "production";
  
  /**
   * If debug is enabled.
   *
   * @type {boolean}
   */
  public static debug: boolean = process.env.NODE_DEBUG && process.env.NODE_DEBUG.indexOf("apes") !== -1;
  
  /**
   * The current configuration.
   *
   * @type {any}
   */
  public configuration: any;
  
  /**
   * The current configuration file path.
   *
   * @type {object}
   */
  public configurationPath: string;
  
  /**
   * The current logger.
   *
   * @type {Logger}
   */
  public logger: Logger;
  
  /**
   * Creates a new application.
   *
   * @param {string} configurationPath The configuration file path.
   */
  constructor(configurationPath: string = "config/application"){
    this.configurationPath = path.resolve(Application.root, configurationPath);
    this.logger = new Logger(`${Application.environment}-main`, true);
  }
  
  /**
   * Performs the main application loop.
   *
   * @returns {Promise<void | Error>} Nothing in case of success, the error otherwise.
   */
  public async run(): Promise<void | Error>{
    let error: Error = null;

    try{
      await this.logger.prepare();
    }catch(e){
      console.error(`Cannot create the logger: ${e}. Exiting ...`);
      process.exit(1);
      return Promise.reject(e);
    }

    try{
      // Prepare the application
      await this.loadConfiguration();
      await this.prepare();

      // Execute
      await this.logger.info(`Process ${Application.processName} started as PID ${process.pid} ...`);
      await this.execute();

      // Cleanup
      await this.logger.info("All operations completed. Exiting ...");
      await this.cleanup();

      return Promise.resolve();
    }catch(e){
      error = e;
      await this.logger.fatal(e);
      return Promise.reject(error);
    }finally{
      try{
        await this.cleanup();
      }catch(e){
        // No-op
      }

      await (error ? this.logger.warn("Process exited with errors.") : this.logger.info("Process exited without errors."));
      process.exit(error ? 1 : 0);
    }
  }
  
  /**
   * Loads and parses the configuration file.
   *
   * @returns {Promise<any | Error>} The configuration in case of success, the error otherwise.
   */
  public loadConfiguration(): Promise<any | Error>{
    try{
      // Load configuration and port
      this.configuration = require(this.configurationPath)[Application.environment] || {}; // tslint:disable-line:no-require-imports

      return Promise.resolve(this.configuration);
    }catch(e){
      return Promise.reject(e);
    }
  }
  
  /**
   * Prepares the application for execution. This **MUST** be overriden by subclasses.
   *
   * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
   */
  protected prepare(): Promise<winston.LoggerInstance | Error | void>{
    return this.logger.warn(`${this.constructor.name}.prepare should override Application.prepare.`);
  }
  
  /**
   * **THIS IS WHERE APPLICATION LOGIC MUST BE PUT.**
   *
   * Executes the application. This **MUST** be overriden by subclasses.
   *
   * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
   */
  protected execute(): Promise<winston.LoggerInstance | Error | void>{
    return this.logger.warn(`${this.constructor.name}.execute should override Application.execute.`);
  }
  
  /**
   * Cleans up the application after the execution. This **MUST** be overriden by subclasses.
   *
   * @returns {Promise<winston.LoggerInstance>} A Logger backend in case of success, the error otherwise.
   */
  protected cleanup(): Promise<winston.LoggerInstance | Error | void>{
    return this.logger.warn(`${this.constructor.name}.cleanup should override Application.cleanup.`);
  }
}
