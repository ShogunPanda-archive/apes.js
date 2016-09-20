/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

import * as path from "path";
import * as fs from "fs-extra";
import * as express from "express";
import * as bodyParser from "body-parser";
import * as compression from "compression";
import * as http from "http";
import * as https from "https";
import * as net from "net";
import * as winston from "winston";

import Application from "../application";
import Logger from "../logger";
import {elapsedTime} from "../utils";
import HTTPProfiler from "./profiler";

const VALID_JSON_BODY: RegExp = /^application\/(.+\+)?json/;

const S_TO_MS: number = 1000;
const DEFAULT_CORS_MAX_AGE: number = 31536000; // One year
const HTTP_STATUS_OK: number = 200;
const HTTP_STATUS_NO_CONTENT: number = 204;
const HTTP_STATUS_BAD_REQUEST: number = 400;
const HTTP_STATUS_NOT_FOUND: number = 404;
const HTTP_STATUS_ERROR: number = 500;

declare module "express"{
  interface Request{
    startTime?: number[];
    extraLogAttributes?: {string: number | string};
  }
}

/**
 * A HTTP server template class.
 *
 * @memberOf HTTP
 */
export default class Server extends Application{
  /**
   * The default HTTP port.
   *
   * @type {number}
   */
  public static defaultPort: number = 3000;
  
  /**
   * The Express backend.
   *
   * @type {express.Application}
   */
  protected express: express.Application;
  
  /**
   * The running HTTP(s) server.
   *
   * @type {net.Server}
   */
  protected server: net.Server;
  
  /**
   * The logger for tracking requests.
   *
   * @type {Logger}
   */
  public requestsLogger: Logger;
  
  /**
   * Prepares the HTTP server for execution.
   *
   * @returns {Promise<winston.LoggerInstance | Logger | Error | void>}
   */
  protected prepare(): Promise<winston.LoggerInstance | Logger | Error | void>{
    this.requestsLogger = new Logger(`${Application.processName}-requests`, !Application.production);

    this.express = express();

    // Add base middlewares and configure Express
    this.express.use(HTTPProfiler);

    // Add GZIP compression and parse JSON body
    if(Application.production)
      this.express.use(compression({threshold: 0}));

    this.express.use(bodyParser.json({type: (req: express.Request) => VALID_JSON_BODY.test(req.header("Content-Type"))}));

    // Only accept JSON bodies
    this.express.use(bodyParser.text({type: (req: express.Request) => !(VALID_JSON_BODY.test(req.header("Content-Type")))}));
    this.express.use((req, res, next) => {
      if(typeof req.body === "string" && req.body.length)
        throw new SyntaxError(`Content-Type header must be match regular expression /${VALID_JSON_BODY.source}/ and the data must a valid encoded JSON.`);

      next();
    });

    // Configure express behavior
    this.express.set("json spaces", Application.production ? 0 : 2);
    this.express.enable("trust proxy");

    // Diagnostic ping
    this.express.get("/ping", (req, res) => {
      res.status(HTTP_STATUS_OK).set({"Content-Type": "text/plain", "X-Up-Time": `${process.uptime() * S_TO_MS}ms`}).end("pong");
    });

    // Add middlewares
    this.addMiddlewares();

    // Add routes
    this.addRoutes();

    // Add error handling
    this.addErrorHandling();

    // Setup logging
    return this.requestsLogger.prepare();
  }
  
  /**
   * Executes the HTTP server.
   *
   * @returns {Promise<winston.LoggerInstance | Logger | Error | void>}
   */
  protected execute(): Promise<winston.LoggerInstance | Logger | Error | void>{
    return new Promise<winston.LoggerInstance | Error | void>((resolve, reject) => {
      const sockets = new Set();

      // Create a HTTP(s) server - SSL is forbiddne in production mode since there should always be a webserver like Nginx in front
      const useSSL: boolean = (process.env.SSL || this.configuration.httpServer.ssl.enabled) && !Application.production;
      this.server = useSSL ? https.createServer(this.sslConfig(), this.express) : http.createServer(this.express);

      // Listen to the port
      this.server.listen(this.configuration.httpServer.port, () => {
        this.logger.info(`Listening for HTTP${useSSL ? "S" : ""} on port ${this.configuration.httpServer.port}.`);
      });

      // Socket tracking to allow to force a shutdown - Otherwise server.close will wait for connection to end.
      this.server.on("connection", (socket: net.Socket) => {
        sockets.add(socket);
        socket.on("close", () => sockets.delete(socket));
      });

      this.server.on("error", reject);

      // Handle termination signals
      for(let signal of ["SIGTERM", "SIGINT", "SIGUSR2"]){
        process.removeAllListeners(signal);
        process.on(signal, () => {
          // Terminate all pending sockets
          for(let socket of sockets)
            socket.destroy();

          // Terminate the server and exit
          this.server.close((error?: Error) => {
            return error ? reject(error) : resolve();
          });
        });
      }
    });
  }
  
  /**
   * Loads and parses the configuration file.
   *
   * @returns {Promise<any | Error>} The configuration in case of success, the error otherwise.
   */
  public loadConfiguration(): Promise<any | Error>{
    return super.loadConfiguration().then(() => {
      if(!this.configuration.httpServer)
        this.configuration.httpServer = {};

      if(!this.configuration.httpServer.port)
        this.configuration.httpServer.port = Server.defaultPort;

      if(!this.configuration.httpServer.ssl)
        this.configuration.httpServer.ssl = {enabled: false};

      return Promise.resolve(this.configuration);
    });
  }
  
  /**
   * Adds middleware to the Express server. This is reserved for subclasses to override. Default implementation does nothing.
   */
  protected addMiddlewares(){
    // Default implementation is a no-op
  }
  
  /**
   * Adds routes to the Express server. This is reserved for subclasses to override. Default implementation does nothing.
   */
  protected addRoutes(){
    // TODO@PI: Write me
  }
  
  /**
   * Adds error handling to the Express server.
   */
  protected addErrorHandling(){
    // Default catch all and error handler
    this.express.use((req, res) => {
      this.sendGeneralError(req, res, HTTP_STATUS_NOT_FOUND, "Not Found.");
    });

    // Error handler for unhandled exceptions
    this.express.use(this.errorHandler.bind(this));
  }
  
  /**
   * Adds CORS handling to the Express server.
   *
   * @param {string} origin A value for the `Access-Control-Allow-Origin` header. If not provided, will be inferred by requests' `Origin` header.
   * @param {string} headers A value for `Access-Control-Allow-Headers` header. If not provided, `*` will be used.
   * @param {string} methods A value for `Access-Control-Allow-Methods` header. If not provided, only **GET** and **POST** methods will be allowed.
   * @param {string} maxAge A value for `Access-Control-Max-Age` header. If not provided, one **year** will be used.
   */
  protected addCORSHandling(origin?: string, headers?: string, methods?: string, maxAge?: number){
    this.express.use((req, res, next) => {
      if(!origin)
        origin = req.header("Origin");

      if(origin){
        res.set({
          "Access-Control-Allow-Origin": req.header("Origin") || origin,
          "Access-Control-Allow-Headers": headers || "*",
          "Access-Control-Allow-Methods": methods || "GET, POST",
          "Access-Control-Max-Age": (maxAge || DEFAULT_CORS_MAX_AGE).toString()
        });
      }

      next();
    });

    this.express.options("/:unused*?", (req, res) => {
      res.status(HTTP_STATUS_NO_CONTENT).end();
    });
  }
  
  /**
   * Configures Express static file serving.
   *
   * @param {string} dir The folder to use as root for static files.
   * @param {string} root The base folder to get a absolute path for `dir`.
   * @returns {string} The absolute static files folder.
   */
  protected setupStaticFolder(dir: string, root?: string): string{
    const final: string = path.resolve(root || Application.root, dir);
    this.express.use(express.static(final));
    return final;
  }
  
  /**
   * Load SSL certificate and key for HTTPS servers.
   *
   * @returns {{key: Buffer, cert: Buffer}} The loaded certificates.
   */
  public sslConfig(): {key: Buffer, cert: Buffer}{
    return {
      key: fs.readFileSync(path.resolve(Application.root, this.configuration.httpServer.ssl.key || "config/ssl/private-key.pem")),
      cert: fs.readFileSync(path.resolve(Application.root, this.configuration.httpServer.ssl.certificate || "config/ssl/certificate.pem"))
    };
  }
  
  /**
   * Replies with a HTTP redirect response to the client.
   *
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP redirect code to use. Defaults to `302`.
   * @param {string} destination The URL where redirect to.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   */
  public redirectTo(req: express.Request, res: express.Response, code: number, destination: string, startTime?: number[]): void{
    if(!startTime)
      startTime = req.startTime || process.hrtime();
    
    if(!code)
      code = 302;
  
    this.logRequest(code, req, startTime);

    res.redirect(code, destination);
  }
  
  /**
   * Sends a response back to the client.
   *
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP response code to use. Defaults to `200`.
   * @param {any} content The data to send back. Strings will set type to be `text/plain`, otherwise `application/json` will be used.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   */
  public sendResponse(req: express.Request, res: express.Response, code: number, content: any, startTime?: number[]): void{
    if(!startTime)
      startTime = req.startTime || process.hrtime();

    if(!code)
      code = 200;
    
    this.logRequest(code, req, startTime);
    res.status(code);

    if(typeof content === "string")
      res.type("text");

    content !== null && typeof content !== "undefined" ? res.send(content) : res.end();
  }
  
  /**
   * Sends a error response back to the client.
   *
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {number} code The HTTP response code to use. Defaults to `200`.
   * @param {string} message The error message to send back.
   * @param {boolean} single If `true`, error will be wrapped in a `error` key, otherwise it will be wrapped in `errors` key.
   */
  public sendGeneralError(req: express.Request, res: express.Response, code: number, message: string, single: boolean = false): void{
    const body = {code, message};
    this.sendResponse(req, res, code, single ? {error: body} : {errors: [body]});
  }
  
  /**
   * The Express catch all error handler.
   *
   * @param {Error | string} error The occurred error.
   * @param {express.Request} req The current Express request.
   * @param {express.Response} res The current Express response.
   * @param {express.NextFunction} next The next middleware. This is to comply with Express API, but the middleware is never called.
   */
  protected errorHandler(error: Error | string, req: express.Request, res: express.Response, next: express.NextFunction): void | boolean | express.Response{
    if(res.headersSent)
      return false;

    if(error instanceof SyntaxError && req.method === "POST"){ // This is a malformed JSON POST body
      return res.status(HTTP_STATUS_BAD_REQUEST).json({
        errors: [{
          code: HTTP_STATUS_BAD_REQUEST,
          message: "Invalid JSON POST data received.",
          error: error.message
        }]
      });
    }

    // Log the error
    this.logger.error(error);

    // On production show a generic message
    if(Application.production)
      return this.sendGeneralError(req, res, HTTP_STATUS_ERROR, "Internal Application Error.");

    // If it's a string, don't try to get type and stack
    if(typeof error === "string")
      return this.sendGeneralError(req, res, HTTP_STATUS_ERROR, error);

    // Format stack
    const stack = error.stack ? error.stack.split("\n") : [];
    stack.shift();

    this.sendResponse(req, res, HTTP_STATUS_ERROR, {type: error.name, message: error.message, stack: stack.map(s => s.trim().replace(/^at\s/, ""))});
  }
  
  /**
   * Logs a request using the requestsLogger.
   *
   * @param {number} code The HTTP code sent to the client.
   * @param {express.Request} req The current Express request.
   * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
   * @returns {winston.LoggerInstance} The requestsLogger backend.
   */
  protected logRequest(code: number, req: express.Request, startTime: number[]): Promise<winston.LoggerInstance>{
    let method: string = null;

    switch(Math.floor(code / 100)){
      case 4:
        method = "warn";
        break;
      case 5:
        method = "error";
        break;
      case 3:
        method = "debug";
        break;
      default:
        method = "info";
        break;
    }

    return Reflect.get(this.requestsLogger, method)(Object.assign(
      {
        status: code,
        elapsed: elapsedTime(startTime),
        ip: req.ip.replace(/^::ffff:/, ""),
        method: req.method,
        url: req.url
      },
      req.method === "POST" ? {body: req.body} : {},
      req.extraLogAttributes || {})
    );
  }
}