/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

/**
 * Error raised within Apes classes.
 *
 * @extends {Error}
 */
class RuntimeError extends Error{
  /**
   * Creates a new error.
   *
   * @param {string} code The error code.
   * @param {string|object} [message=null] The error message or a object containing the `message` property
   * @param {any} [error=null] The wrapped error.
   */
  constructor(code, message = null, error = null){
    code = code.toString().toUpperCase();

    if(error instanceof RuntimeError){ // Copy operator
      super(error.message);
      this.wrappedError = error.wrappedError;
    }else{
      let data = [];
      if(message && typeof message === "object"){
        data = Object.assign({}, message);
        Reflect.deleteProperty(data, "message");
        message = message.message;
      }

      super(error ? (error.message || error) : (message || code)); // eslint-disable-line no-extra-parens
      this.data = data;

      if(error instanceof Error)
        this.wrappedError = error;
    }

    this.code = code;
  }
}

module.exports = RuntimeError;
