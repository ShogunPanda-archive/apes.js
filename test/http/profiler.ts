/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/* tslint:disable:no-var-requires no-require-imports */

import * as chai from "chai";
import {expect} from "chai";
import * as sinon from "sinon";
import * as os from "os";
import * as express from "express";

chai.use(require("chai-http"));

import Profiler from "../../lib/http/profiler";

describe("HTTP.Profiler", function(){
  it("should add profiling information to the response", function(){
    const hrtimeStub = sinon.stub(process, "hrtime").returns([4, 123000]);

    const subject = express();
    subject.use(Profiler);
    subject.get("/", (req, res) => res.status(200).end());

    return chai.request(subject).get("/").then(response => {
      hrtimeStub.restore();

      expect(response).to.have.header("X-Served-By", os.hostname());
      expect(response).to.have.header("X-Response-Time", "4000.123ms");
    });
  });
});
