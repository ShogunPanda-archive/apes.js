/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

import * as express from "express";
import * as os from "os";

import {sprintf} from "sprintf-js";
import onHeaders = require("on-headers"); // tslint:disable-line:no-require-imports

import * as Utils from "../utils";

/**
 * A set of utilities to simplify HTTP applications authoring.
 * @namespace HTTP
 */

/**
 * Profiles server and timing informations to the current request.
 *
 * @memberOf HTTP
 * @param {express.Request} req The current request.
 * @param {express.Response} res The current response.
 * @param {express.NextFunction} next The next middleware.
 */
export default function Profiler(req: express.Request, res: express.Response, next: express.NextFunction): void{
  const startTime: number[] = process.hrtime();

  // When sending headers, add the hostname and the response time.
  onHeaders(res, () => {
    res.set("X-Served-By", os.hostname());
    res.set("X-Response-Time", sprintf("%0.3fms", Utils.elapsedTime(startTime)));
  });

  next();
}
