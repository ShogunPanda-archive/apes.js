/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

const path = require("path");
const os = require("os");

const Utils = require("./utils");
const Logger = require("./logger");


/**
 * A boilerplate for Node.js applications.
 *
 * @class Application
 */
class Application{
  /**
   * Setup the application environment.
   *
   * @param {string} [root=null] The root directory of the application.
   */
  static setupGlobalEnvironment(root = null){
    Application.mainFile = require.main.filename;
    Application.root = root || path.resolve(path.basename(Application.mainFile), "..");
    Application.environment = !Utils.isEmptyString(process.env.NODE_ENV) ? process.env.NODE_ENV : "development";
    Application.production = Application.environment === "production";
    Application.debug = (process.env.NODE_DEBUG || "").indexOf("apes") !== -1;

    Application.pid = process.pid;
    Application.processName = !Utils.isEmptyString(process.env.PROCESS_NAME) ? process.env.PROCESS_NAME : path.basename(process.argv[1]);
    Application.hostName = os.hostname();

    Application.packageInfo = require(path.resolve(Application.root, "package.json")); // eslint-disable-line global-require
    Application.label = process.env.PROCESS_NAME || Application.packageInfo.label || process.argv[1];
    Application.version = Application.packageInfo.version || "1.0.0";
  }

  /**
   * Creates a new application.
   *
   * @param {string} [configurationPath="config/application"] The configuration file path.
   */
  constructor(configurationPath = "config/application"){
    this.configurationPath = path.resolve(Application.root, configurationPath);
    this.logger = new Logger(Application.processName, true);
  }

  /**
   * Performs the main application loop.
   *
   * @returns {Promise<void | Error>} Nothing in case of success, the error otherwise.
   */
  async run(){
    let error = null;
    let cleaned = false;

    try{
      await this.logger.prepare();
    }catch(e){
      console.error(`Cannot create the logger: ${e}. Exiting ...`);
      process.exit(1); // eslint-disable-line no-process-exit
    }

    try{
      await this.start();
      cleaned = true;
    }catch(e){
      error = e;
      await this.logger.fatal(e);
    }

    await this.end(error, !cleaned);
    return error ? Promise.reject(error) : Promise.resolve();
  }

  /**
   * Loads and parses the configuration file.
   *
   * @returns {Promise<any | Error>} The configuration in case of success, the error otherwise.
   */
  loadConfiguration(){
    try{
      const configurations = require(this.configurationPath); // eslint-disable-line global-require

      if(typeof configurations !== "object")
        throw new TypeError(`File ${this.configurationPath} must contain a JSON object.`);

      // Load configuration and port
      this.configuration = configurations[Application.environment] || Object.values(configurations)[0] || {};

      return Promise.resolve(this.configuration);
    }catch(e){
      return Promise.reject(e);
    }
  }

  /**
   * Prepares the application for execution. This **MUST** be overriden by subclasses.
   *
   * @returns {Promise<winston.Logger>} A Logger backend in case of success, the error otherwise.
   */
  prepare(){
    return this.logger.warn(`${this.constructor.name}.prepare should override Application.prepare.`);
  }

  /**
   * **THIS IS WHERE APPLICATION LOGIC MUST BE PUT.**
   *
   * Executes the application. This **MUST** be overriden by subclasses.
   *
   * @returns {Promise<winston.Logger>} A Logger backend in case of success, the error otherwise.
   */
  execute(){
    return this.logger.warn(`${this.constructor.name}.execute should override Application.execute.`);
  }

  /**
   * Cleans up the application after the execution. This **MUST** be overriden by subclasses.
   *
   * @returns {Promise<winston.Logger>} A Logger backend in case of success, the error otherwise.
   */
  cleanup(){
    return this.logger.warn(`${this.constructor.name}.cleanup should override Application.cleanup.`);
  }

  /**
   * Starts the application.
   *
   * @private
   */
  async start(){
    // Prepare the application
    await this.loadConfiguration();
    await this.prepare();

    // Execute
    await this.logger.info(`Process ${Application.processName} started as PID ${Application.pid} ...`);
    await this.execute();

    // Cleanup
    await this.logger.info("All operations completed. Exiting ...");
    await this.cleanup();
  }

  /**
   * Ends the application.
   *
   * @private
   * @param {Error} error The occurred error, if any.
   * @param {boolean} mustClean If the application must be cleaned up.
   */
  async end(error, mustClean){
    try{
      if(mustClean)
        await this.cleanup();
    }catch(e){
      // No-op since we're shutting down
    }

    await (error ? this.logger.warn("Process exited with errors.") : this.logger.info("Process exited without errors.")); // eslint-disable-line no-extra-parens
    process.exit(error ? 1 : 0); // eslint-disable-line no-process-exit
  }
}

Application.setupGlobalEnvironment();

module.exports = Application;
