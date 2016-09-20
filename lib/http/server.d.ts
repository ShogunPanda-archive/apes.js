/// <reference types="express" />
/// <reference types="node" />
import * as express from "express";
import * as net from "net";
import * as winston from "winston";
import { Application } from "../application";
import { Logger } from "../logger";
declare module "express" {
    interface Request {
        startTime?: number[];
        extraLogAttributes?: {
            string: number | string;
        };
    }
}
/**
 * A set of utilities to simplify HTTP applications authoring.
 *
 * @namespace {HTTP}
 */
export declare namespace HTTP {
    /**
     * Profiles server and timing informations to the current request.
     *
     * @member HTTP
     * @param {express.Request} req The current request.
     * @param {express.Response} res The current response.
     * @param {express.NextFunction} next The next middleware.
     */
    function Profiler(req: express.Request, res: express.Response, next: express.NextFunction): void;
    /**
     * A HTTP server template class.
     *
     * @member HTTP
     */
    class Server extends Application {
        /**
         * The default HTTP port.
         *
         * @type {number}
         */
        static defaultPort: number;
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
        requestsLogger: Logger;
        /**
         * Prepares the HTTP server for execution.
         *
         * @returns {Promise<winston.LoggerInstance | Logger | Error | void>}
         */
        protected prepare(): Promise<winston.LoggerInstance | Logger | Error | void>;
        /**
         * Executes the HTTP server.
         *
         * @returns {Promise<winston.LoggerInstance | Logger | Error | void>}
         */
        protected execute(): Promise<winston.LoggerInstance | Logger | Error | void>;
        /**
         * Loads and parses the configuration file.
         *
         * @returns {Promise<any | Error>} The configuration in case of success, the error otherwise.
         */
        loadConfiguration(): Promise<any | Error>;
        /**
         * Adds middleware to the Express server. This is reserved for subclasses to override. Default implementation does nothing.
         */
        protected addMiddlewares(): void;
        /**
         * Adds routes to the Express server. This is reserved for subclasses to override. Default implementation does nothing.
         */
        protected addRoutes(): void;
        /**
         * Adds error handling to the Express server.
         */
        protected addErrorHandling(): void;
        /**
         * Adds CORS handling to the Express server.
         *
         * @param {string} origin A value for the `Access-Control-Allow-Origin` header. If not provided, will be inferred by requests' `Origin` header.
         * @param {string} headers A value for `Access-Control-Allow-Headers` header. If not provided, `*` will be used.
         * @param {string} methods A value for `Access-Control-Allow-Methods` header. If not provided, only **GET** and **POST** methods will be allowed.
         * @param {string} maxAge A value for `Access-Control-Max-Age` header. If not provided, one **year** will be used.
         */
        protected addCORSHandling(origin?: string, headers?: string, methods?: string, maxAge?: number): void;
        /**
         * Configures Express static file serving.
         *
         * @param {string} dir The folder to use as root for static files.
         * @param {string} root The base folder to get a absolute path for `dir`.
         * @returns {string} The absolute static files folder.
         */
        protected setupStaticFolder(dir: string, root?: string): string;
        /**
         * Load SSL certificate and key for HTTPS servers.
         *
         * @returns {{key: Buffer, cert: Buffer}} The loaded certificates.
         */
        sslConfig(): {
            key: Buffer;
            cert: Buffer;
        };
        /**
         * Replies with a HTTP redirect response to the client.
         *
         * @param {express.Request} req The current Express request.
         * @param {express.Response} res The current Express response.
         * @param {number} code The HTTP redirect code to use. Defaults to `302`.
         * @param {string} destination The URL where redirect to.
         * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
         */
        redirectTo(req: express.Request, res: express.Response, code: number, destination: string, startTime?: number[]): void;
        /**
         * Sends a response back to the client.
         *
         * @param {express.Request} req The current Express request.
         * @param {express.Response} res The current Express response.
         * @param {number} code The HTTP response code to use. Defaults to `200`.
         * @param {any} content The data to send back. Strings will set type to be `text/plain`, otherwise `application/json` will be used.
         * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
         */
        sendResponse(req: express.Request, res: express.Response, code: number, content: any, startTime?: number[]): void;
        /**
         * Sends a error response back to the client.
         *
         * @param {express.Request} req The current Express request.
         * @param {express.Response} res The current Express response.
         * @param {number} code The HTTP response code to use. Defaults to `200`.
         * @param {string} message The error message to send back.
         * @param {boolean} single If `true`, error will be wrapped in a `error` key, otherwise it will be wrapped in `errors` key.
         */
        sendGeneralError(req: express.Request, res: express.Response, code: number, message: string, single?: boolean): void;
        /**
         * The Express catch all error handler.
         *
         * @param {Error | string} error The occurred error.
         * @param {express.Request} req The current Express request.
         * @param {express.Response} res The current Express response.
         * @param {express.NextFunction} next The next middleware. This is to comply with Express API, but the middleware is never called.
         */
        protected errorHandler(error: Error | string, req: express.Request, res: express.Response, next: express.NextFunction): void | boolean | express.Response;
        /**
         * Logs a request using the requestsLogger.
         *
         * @param {number} code The HTTP code sent to the client.
         * @param {express.Request} req The current Express request.
         * @param {number[]} startTime The starting time of the request, as returned by `process.hrtime()`.
         * @returns {winston.LoggerInstance} The requestsLogger backend.
         */
        protected logRequest(code: number, req: express.Request, startTime: number[]): Promise<winston.LoggerInstance>;
    }
}
