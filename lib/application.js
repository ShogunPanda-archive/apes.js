/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

const path = require("path");
const os = require("os");

const Utils = require("./utils");
const Logger = require("./logger");

/**
 * A module to easily create Node.js applications with a defined environment and a default logger based on [Winston](http://npmjs.com/package/winston).
 *
 * @namespace Application
 */
const Application = {
  /**
   * Creates and executes a new application. It's a short hand for {@link Application.create} followed by {@link Application.run}.
   *
   * @param {string} configurationRoot The root key in `package.json` holding application configuration.
   * @param {Function} main The main application loop. It will receive a application object as the only argument.
   * @param {string} [root=null] The root directory of the application.
   * @param {Function} [prepare=null] A optional function to run right **before** the main loop. It will receive a application object as the only argument.
   * @param {Function} [cleanup=null] A optional function to run right **after** the main loop. It will receive a application object as the only argument.
   * @returns {Promise<void|Error>} Nothing in case of success, the error otherwise.
   */
  async execute(configurationRoot, main, root = null, prepare = null, cleanup = null){
    const application = Application.create(configurationRoot || "apes", root);
    return await Application.run(application, main, prepare, cleanup);
  },

  /**
   * Creates a new application.
   *
   * @param {string} [configurationRoot="apes"] The root key in `package.json` holding application configuration.
   * @param {string} [root=null] The root directory of the application.
   * @return {object} The new application object.
   */
  create(configurationRoot = "apes", root = null){
    const rv = {};

    // Application settings
    rv.mainFile = require.main.filename;
    rv.root = root || path.resolve(path.basename(rv.mainFile), "..");
    rv.configurationRoot = configurationRoot;
    rv.environment = !Utils.isEmptyString(process.env.NODE_ENV) ? process.env.NODE_ENV : "development";
    rv.production = rv.environment === "production";
    rv.debug = (process.env.NODE_DEBUG || "").indexOf("apes") !== -1;

    // Runtime settings
    rv.pid = process.pid;
    rv.processName = !Utils.isEmptyString(process.env.PROCESS_NAME) ? process.env.PROCESS_NAME : path.basename(process.argv[1]);
    rv.hostName = os.hostname();

    // Misc settngs
    rv.packageInfo = Application._loadPackageJSON(rv);
    rv.label = process.env.PROCESS_NAME || rv.packageInfo.label || process.argv[1];
    rv.version = rv.packageInfo.version || "1.0.0";

    return rv;
  },

  /**
   * Performs the main application loop.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @param {Function} main The main application loop. It will receive a application object as the only argument.
   * @param {Function} [prepare=null] A optional function to run right **before** the main loop. It will receive a application object as the only argument.
   * @param {Function} [cleanup=null] A optional function to run right **after** the main loop. It will receive a application object as the only argument.
   * @returns {Promise<void|Error>} Nothing in case of success, the error otherwise.
   */
  async run(application, main, prepare = null, cleanup = null){
    let error = null;
    let cleaned = false;

    try{
      if(!application.logger)
        application.logger = await Logger.create(application, application.processName, true);
    }catch(e){
      console.error(`Cannot create the logger: ${e}. Exiting ...`);
      process.exit(1); // eslint-disable-line no-process-exit
      return Promise.reject(e);
    }

    try{
      await Application._start(application, main, prepare, cleanup);
      cleaned = true;
    }catch(e){
      error = e;
      await Logger.fatal(application.logger, e);
    }

    await Application._end(application, error, !cleaned ? cleanup : null);
    return error ? Promise.reject(error) : Promise.resolve();
  },

  /**
   * Loads and parses the application configuration.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @returns {object|Error} The configuration in case of success, the error otherwise.
   */
  loadConfiguration(application){
    const configurations = application.packageInfo[application.configurationRoot];

    if(typeof configurations !== "object")
      throw new TypeError(`The value of the key "${application.configurationRoot}" in package.json must be a object.`);

    // Load configuration and port
    return configurations[application.environment] || Object.values(configurations)[0] || {};
  },

  /**
   * Loads the `package.json` information, falling back to `{}` in case of errors.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @returns {object} The package.json informations, falling back to `{}`.
   * @private
   */
  _loadPackageJSON(application){
    try{
      return require(path.resolve(application.root, "package.json")); // eslint-disable-line global-require
    }catch(e){
      return {};
    }
  },

  /**
   * Starts the application.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @param {Function} main The main application loop. It will receive a application object as the only argument.
   * @param {Function} prepare A function to run right **before** the main loop. It will receive a application object as the only argument.
   * @param {Function} cleanup A function to run right **after** the main loop. It will receive a application object as the only argument.
   * @private
   */
  async _start(application, main, prepare, cleanup){
    // Prepare the application
    application.configuration = Application.loadConfiguration(application);

    if(typeof prepare === "function")
      await prepare(application);

    // Execute
    await Logger.info(application.logger, `Process ${application.processName} started as PID ${application.pid} ...`);
    if(typeof main === "function")
      await main(application);
    else
      await Logger.error(application, "A main loop must be provided.");

    // Cleanup
    await Logger.info(application.logger, "All operations completed. Exiting ...");

    if(typeof cleanup === "function")
      await cleanup(application);
  },

  /**
   * Ends the application.
   *
   * @param {object} application A application object (created via {@link Application.create}).
   * @param {Error} error The occurred error, if any.
   * @param {Function} cleanup A function to run right after the main loop.
   * @private
   */
  async _end(application, error, cleanup){
    try{
      if(typeof cleanup === "function")
        await cleanup(application);
    }catch(e){
      // No-op since we're shutting down
    }

    await (error ? Logger.warn(application.logger, "Process exited with errors.") : Logger.info(application.logger, "Process exited without errors.")); // eslint-disable-line no-extra-parens
  }
};

module.exports = Application;
