/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
 */

const moment = require("moment");
const crypto = require("crypto");

const Constants = require("./constants");

/**
 * A module with common utility methods.
 *
 * @namespace Utils
 */
const Utils = {
  /**
   * Checks whether a string is empty.
   *
   * @param {string} target The string to verify.
   * @returns {boolean} `true` if `target` is a non-string or if it is empty, `false` otherwise.
   */
  isEmptyString(target){
    return typeof target !== "string" || !target.trim().length;
  },

  /**
   * Encodes a string to Base 64 encoding.
   *
   * @param {string} data The data to encode.
   * @returns {string} The encoded data.
   */
  encodeBase64(data){
    return Buffer.from(data, "utf8").toString("base64").toString("base64");
  },

  /**
   * Decodes a string from Base 64 encoding.
   *
   * @param {string} data The data to decode.
   * @param {boolean} [asString=true] If `true`, a UTF-8 string will be returned, otherwise a Node.js Buffer.
   * @returns {string|Buffer} The decoded data.
   */
  decodeBase64(data, asString = true){
    const decoded = Buffer.from(data, "base64");

    return asString ? decoded.toString("utf8") : decoded;
  },

  /**
   * Computes the MD5 hash of a string.
   *
   * @param {string} data The string to compute the hash of.
   * @returns {string} The MD5 hash of the input string.
   */
  md5(data){
    return crypto.createHash("md5").update(data).digest("hex");
  },

  /**
   * Parses a object as a boolean.
   *
   * @param {any} value The value to parse.
   * @returns {boolean} The boolean value.
   */
  parseBoolean(value){
    return value && value.toString().match(Constants.Utils.TRUE_BOOLEAN_MATCHER) !== null;
  },

  /**
   * Parses a date.
   *
   * @param {string|number} raw The string or number to parse. Numbers are interpreted as `X days ago`, positive and negative values have the same meaning.
   * @param {moment|number} [fallback=null] The fallback value to return when parsing fails.
   * @returns {moment} The parsed date.
   */
  parseDate(raw, fallback = null){
    if(typeof raw === "string" || typeof raw === "number"){
      raw = raw.toString();

      let value = null;

      if(raw.match(/^(-?)\d+$/)) // Relative days ago. Future is obviously not supported. Positive and negative values have the same meaning
        value = Utils.utcDate().subtract(Math.abs(parseInt(raw, 0)), "d");
      else if(raw.match(/^\d{4}-\d{2}-\d{2}$/)) // Absolute date in the format YYYY-MM-DD.
        value = Utils.utcDate(raw);

      if(value && value.isValid())
        return value;
    }

    if(typeof fallback === "number")
      return Utils.utcDate().subtract(Math.abs(fallback), "d");

    return fallback;
  },

  /**
   * Parses a timestamp.
   *
   * @param {string} raw The string to parse.
   * @param {string} [formats=["YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.SSSZZ"]] A list of format to use for parsing.
   * @param {boolean} [utc=true] Whether to return the timestamp in UTC timezone.
   * @param {any} [fallback=null] The fallback value to return when parsing fails.
   * @returns {moment} The parsed timestamp.
   */
  parseDateTime(raw, formats = ["YYYY-MM-DDTHH:mm:ssZ", "YYYY-MM-DDTHH:mm:ss.SSSZZ"], utc = true, fallback = null){
    for(let format of formats){ // eslint-disable-line prefer-const
      const value = moment(raw, format);

      if(value.isValid())
        return utc ? value.utc() : value;
    }

    if(typeof fallback === "number")
      return Utils.utcDate().subtract(Math.abs(fallback), "d");

    return fallback;
  },

  /**
   * Parses a date string in UTC timezone.
   *
   * @param {string} date The date to parse.
   * @returns {moment} The parsed date.
   */
  utcDate(date){
    if(!date)
      date = moment().format("YYYY-MM-DD");

    return moment.utc(`${date} 00:00:00 +0000`, "YYYY-MM-DD HH:mm:ss Z");
  },

  /**
   * Serializes a timestamp as a string.
   *
   * @param {moment} date The timestamp to serialize.
   * @param {string} [format="YYYY-MM-DDTHH:mm:ssZ"] The format to use.
   * @returns {string} The serialized timestamp.
   */
  serializeDate(date, format = "YYYY-MM-DDTHH:mm:ssZ"){
    return date.utc().format(format);
  },

  /**
   * Returns the elapsed time (in milliseconds) since a reference time.
   *
   * @param {number[]} start The starting reference time, as returned by `process.hrtime()`.
   * @param {boolean} [round=true] Whether or not round the results.
   * @param {number} [precision=Constants.Utils.OUTPUT_PRECISION] The precision to run in case of rounding.
   * @returns {number|string} If `round` is true, a string with the elapsed time, otherwise a full precision number.
   */
  elapsedTime(start, round = true, precision = Constants.Utils.OUTPUT_PRECISION){
    if(!start)
      return null;

    let elapsed = process.hrtime(start);
    elapsed = elapsed[0] * Constants.Utils.S_TO_MS + elapsed[1] / Constants.Utils.US_TO_MS;

    if(round)
      elapsed = elapsed.toPrecision(precision);

    return elapsed;
  },

  /**
   * Flattens an array.
   *
   * @param {array} array The array to flatten
   * @param {number} [maxDepth=-1] The maximum level to flatten. Non positive values mean "flatten all".
   * @returns {array} The flattened array.
   */
  flatten(array, maxDepth = -1){
    const innerFlatten = (slice, currentDepth, rv) => {
      for(let element of slice){ // eslint-disable-line prefer-const
        if(Array.isArray(element) && currentDepth !== 0)
          innerFlatten(element, currentDepth - 1, rv);
        else
          rv.push(element);
      }

      return rv;
    };

    return innerFlatten(Utils.clone(Array.isArray(array) ? array : [array]), maxDepth, []);
  },

  /**
   * Removes duplicate entries inside an array.
   *
   * @param {array} array The array to unicize.
   * @returns {array} The input array with all duplicate values removed.
   */
  uniq(array){
    if(!Array.isArray(array))
      array = [array];

    return [...new Set(array)];
  },

  /**
   * Removes duplicate entries inside an array.
   *
   * @param {array} array The array to unicize.
   * @returns {array} The input array with all duplicate values removed.
   */
  unique(array){
    return Utils.uniq(array);
  },

  /**
   * Tokenizes a list of string using a separator.
   *
   * @param {string[]} list The list of strings to tokenize.
   * @param {string|Regex} [pattern=/\s*,\s*\/] The pattern to use as separator.
   * @returns {array} The list of tokens.
   */
  tokenize(list, pattern = /\s*,\s*/){
    if(!Array.isArray(list))
      list = [list];

    const entries = Utils.flatten(list).filter(k => k).map(el => el.toString().split(pattern).map(k => k.trim())); // Flatten, remove empty values, split by comma and trim
    return Utils.uniq(Utils.flatten(entries).filter(k => k)); // Flatten again, remove empty values, then duplicates
  },

  /**
   * Returns a random value.
   *
   * @param {number} min The minimum acceptable value.
   * @param {number} max The maximum acceptable value.
   * @returns {number} A random number between `min` and `max` (inclusive).
   */
  random(min, max){
    return min + Math.random() * (max - min);
  },

  /**
   * Returns a sequence of numbers.
   *
   * @param {any} start The starting number.
   * @param {any} end The ending number.
   * @param {boolean} [inclusive=false] Whether or not `end` is included in the returned array.
   * @returns {number[]} A sequence of numbers starting with `start` and ending with `end`.
   */
  range(start, end, inclusive = false){
    // Parse as numbers
    start = parseFloat(start, 0);
    end = parseFloat(end, 0);

    // Early returns in case of invalids and negatives
    if(isNaN(start) || isNaN(end) || start < 0 || end < 0)
      return [];
    else if(start > end) // Swap badly ordered arguments
      [end, start] = [start, end];

    // Make integers
    start = Math.floor(start);
    end = Math.floor(end);

    // Generate the range
    const length = end - start + (inclusive ? 1 : 0);
    return [...Array(length)].map((_, i) => start + i);
  },

  /**
   * Creates a async function which resolves after the specified amount.
   *
   * @param {any} amount The amount of time to wait before returning, in milliseconds.
   */
  async delay(amount){
    await new Promise(resolve => setTimeout(resolve, amount));
  },

  /**
   * Clones a object (only properties).
   *
   * @param {object} object The object to clone.
   * @returns {object} The cloned object.
   */
  clone(object){
    if(typeof object !== "object")
      return object;

    return JSON.parse(JSON.stringify(object));
  }
};

module.exports = Utils;
