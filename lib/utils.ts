/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

import * as crypto from "crypto";

const S_TO_MS: number = 1E3;
const US_TO_MS: number = 1E6;
const OUTPUT_PRECISION: number = 6;

/**
 * A set of common utility methods.
 * @namespace Utils
 */
export namespace Utils{
  /**
   * A Regular Expression to match a true boolean value.
   *
   * @type {RegExp}
   * @memberOf Utils
   */
  export const trueBooleanRegex: RegExp = /^(\s*(1|true|yes|t|y|on)\s*)$/i;

  /**
   * Encodes a string to Base 64 encoding.
   *
   * @memberOf Utils
   * @param {string} data The data to encode.
   * @returns {string} The encoded data.
   */
  export function encodeBase64(data: string): string{
    return Buffer.from(data, "utf8").toString("base64");
  }

  /**
   * Decodes a string from Base 64 encoding.
   *
   * @memberOf Utils
   * @param {string} data The data to decode.
   * @param asString If `true`, a UTF-8 string will be returned, otherwise a Node.js Buffer.
   * @returns {string|Buffer} The decoded data.
   */
  export function decodeBase64(data: string, asString: boolean = true): string | Buffer{
    const decoded = Buffer.from(data, "base64");
    return asString ? decoded.toString("utf8") : decoded;
  }

  /**
   * Computes the MD5 hash of a string.
   *
   * @memberOf Utils
   * @param {string} data The string to compute the hash of.
   * @returns {string} The MD5 hash of the input string.
   */
  export function md5(data: string): string{
    return crypto.createHash("md5").update(data).digest("hex");
  }

  /**
   * Parses a object as a boolean.
   *
   * @memberOf Utils
   * @see trueBooleanRegex
   * @param {any} value The value to parse.
   * @returns {boolean} The boolean value.
   */
  export function parseBoolean(value: any): boolean{
    return value && value.toString().match(trueBooleanRegex) !== null;
  }

  /**
   * Return the elapsed time (in milliseconds) since a reference time.
   *
   * @memberOf Utils
   * @param {number[]} start The starting reference time, as returned by `process.hrtime()`.
   * @param {boolean} round Whether or not round the results.
   * @param {number} precision The precision to run in case of rounding.
   * @returns {number | string} If `round` is true, a string with the elapsed time, otherwise a full precision number.
   */
  export function elapsedTime(start: number[] = null, round: boolean = true, precision: number = OUTPUT_PRECISION): number | string | null{
    if(!start)
      return null;

    let elapsed: number[]|number|string = process.hrtime(start);

    elapsed = elapsed[0] * S_TO_MS + elapsed[1] / US_TO_MS;

    if(round)
      elapsed = elapsed.toFixed(precision).replace(/(\d+\.\d+?)0+$/, "$1");

    return elapsed;
  }
}
