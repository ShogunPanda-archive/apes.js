/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/**
  * Error raised within Apes classes.
  *
  * @param {string} code The error code.
  * @param {string|object} [message=null] The error message or a object containing the `message` property
  * @param {any} [error=null] The wrapped error.
  * @return {Error} A error, extended with Apes properties.
  * @namespace RuntimeError
  */
const RuntimeError = function(code, message = null, error = null){
  let rv = null;
  code = code.toString().toUpperCase();

  if(error instanceof Error && error._isApesError){ // Copy operator
    rv = new Error(error.message);
    rv.wrappedError = error.wrappedError;
  }else{
    const data = Object.assign({}, message);
    Reflect.deleteProperty(data, "message");

    if(message && typeof message === "object")
      message = message.message;

    rv = new Error(error ? (error.message || error) : (message || code)); // eslint-disable-line no-extra-parens
    rv.data = data;

    if(error instanceof Error)
      rv.wrappedError = error;
  }

  rv._isApesError = true;
  rv.code = code;
  return rv;
};

module.exports = RuntimeError;
