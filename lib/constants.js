/*
 * This file is part of the apes.js npm package. Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.
 * Licensed under the MIT license, which can be found at http://www.opensource.org/licenses/mit-license.php.
 */

module.exports = {
  Utils: {
    OUTPUT_PRECISION: 6,
    S_TO_MS: 1E3,
    US_TO_MS: 1E6,
    TRUE_BOOLEAN_MATCHER: /^(\s*(1|true|yes|t|y|on)\s*)$/i
  },

  Serialization: {
    NUMBER_SERIALIZATION_PRECISION: 6
  },

  HTTP: {
    DEFAULT_CORS_MAX_AGE: 31536000, // One year
    VALID_JSON_BODY: /^application\/(.+\+)?json/,

    Statuses: {
      OK: 200,
      CREATED: 201,
      ACCEPTED: 202,
      NO_CONTENT: 204,
      RESET: 205,
      PARTIAL_CONTENT: 206,
      MULTIPLE: 300,
      MOVED: 301,
      FOUND: 302,
      NOT_MODIFIED: 304,
      TEMPORARY_REDIRECT: 307,
      PERMANENT_REDIRECT: 308,
      BAD_REQUEST: 400,
      UNAUTHORIZED: 401,
      FORBIDDEN: 403,
      NOT_FOUND: 404,
      NOT_ALLOWED: 405,
      NOT_ACCEPTABLE: 406,
      CLIENT_TIMEOUT: 408,
      CONFLICT: 409,
      GONE: 410,
      UNSUPPORTED_MEDIA_TYPE: 415,
      UNPROCESSABLE_ENTITY: 422,
      RATE_LIMIT: 429,
      CLIENT_RESET: 499,
      ERROR: 500,
      NOT_IMPLEMENTED: 501,
      GATEWAY_ERROR: 502,
      GATEWAY_TIMEOUT: 504,
      NETWORK_ERROR: 599
    },

    StatusClasses: {
      SEPARATOR: 100,
      INFO: 1,
      SUCCESS: 2,
      REDIRECT: 3,
      CLIENT_ERROR: 4,
      SERVER_ERROR: 5
    }
  }
};
