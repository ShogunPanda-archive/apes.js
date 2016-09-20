/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */
"use strict";
const os = require("os");
const sprintf_js_1 = require("sprintf-js");
const onHeaders = require("on-headers"); // tslint:disable-line:no-require-imports
const Utils = require("../utils");
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
function Profiler(req, res, next) {
    const startTime = process.hrtime();
    // When sending headers, add the hostname and the response time.
    onHeaders(res, () => {
        res.set("X-Served-By", os.hostname());
        res.set("X-Response-Time", sprintf_js_1.sprintf("%0.3fms", Utils.elapsedTime(startTime)));
    });
    next();
}
Object.defineProperty(exports, "__esModule", { value: true });
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
exports.default = Profiler;
//# sourceMappingURL=profiler.js.map