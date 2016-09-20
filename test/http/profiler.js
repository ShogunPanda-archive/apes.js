/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */
"use strict";
/* tslint:disable:no-var-requires no-require-imports */
const chai = require("chai");
const chai_1 = require("chai");
const sinon = require("sinon");
const os = require("os");
const express = require("express");
chai.use(require("chai-http"));
const profiler_1 = require("../../lib/http/profiler");
describe("HTTP.Profiler", function () {
    it("should add profiling information to the response", function () {
        const hrtimeStub = sinon.stub(process, "hrtime").returns([4, 123000]);
        const subject = express();
        subject.use(profiler_1.default);
        subject.get("/", (req, res) => res.status(200).end());
        return chai.request(subject).get("/").then(response => {
            hrtimeStub.restore();
            chai_1.expect(response).to.have.header("X-Served-By", os.hostname());
            chai_1.expect(response).to.have.header("X-Response-Time", "4000.123ms");
        });
    });
});
//# sourceMappingURL=profiler.js.map