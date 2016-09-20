/// <reference types="node" />
/**
 * A set of common utility methods.
 * @namespace Utils
 */
export declare namespace Utils {
    /**
     * A Regular Expression to match a true boolean value.
     *
     * @type {RegExp}
     * @memberOf Utils
     */
    const trueBooleanRegex: RegExp;
    /**
     * Encodes a string to Base 64 encoding.
     *
     * @memberOf Utils
     * @param {string} data The data to encode.
     * @returns {string} The encoded data.
     */
    function encodeBase64(data: string): string;
    /**
     * Decodes a string from Base 64 encoding.
     *
     * @memberOf Utils
     * @param {string} data The data to decode.
     * @param asString If `true`, a UTF-8 string will be returned, otherwise a Node.js Buffer.
     * @returns {string|Buffer} The decoded data.
     */
    function decodeBase64(data: string, asString?: boolean): string | Buffer;
    /**
     * Computes the MD5 hash of a string.
     *
     * @memberOf Utils
     * @param {string} data The string to compute the hash of.
     * @returns {string} The MD5 hash of the input string.
     */
    function md5(data: string): string;
    /**
     * Parses a object as a boolean.
     *
     * @memberOf Utils
     * @see trueBooleanRegex
     * @param {any} value The value to parse.
     * @returns {boolean} The boolean value.
     */
    function parseBoolean(value: any): boolean;
    /**
     * Return the elapsed time (in milliseconds) since a reference time.
     *
     * @memberOf Utils
     * @param {number[]} start The starting reference time, as returned by `process.hrtime()`.
     * @param {boolean} round Whether or not round the results.
     * @param {number} precision The precision to run in case of rounding.
     * @returns {number | string} If `round` is true, a string with the elapsed time, otherwise a full precision number.
     */
    function elapsedTime(start?: number[], round?: boolean, precision?: number): number | string | null;
}
