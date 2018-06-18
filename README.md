# apes.js

[![Package Version](https://img.shields.io/npm/v/apes.svg)](https://npmjs.com/package/apes)
[![Dependency Status](https://img.shields.io/gemnasium/ShogunPanda/apes.js.svg)](https://gemnasium.com/ShogunPanda/apes.js)
[![Build Status](https://img.shields.io/travis/ShogunPanda/apes.js.svg)](http://travis-ci.org/ShogunPanda/apes.js)
[![Coverage Status](https://img.shields.io/coveralls/github/ShogunPanda/apes.js.svg)](https://coveralls.io/github/ShogunPanda/apes.js)

## END OF DEVELOPMENT NOTICE

# This package has been discontinued.

A tiny application and HTTP API framework for Express.js.

https://sw.cowtech.it/apes.js

## Supported implementations.

apes.js is written using async/await, which is available from Node 7.0.0 using `--harmony_async-await` flag.

## Usage

### Standalone application

To create a Node.js application which already takes care of logging, call the `Application.execute` and provide a main function.

The function will be called with a `application` object, which has a `logger` setup.

```javascript
const apes = require("apes")

apes.Application.execute("confRoot", application => {
  // Do something here
})
```

### HTTP Server

To create a fully working light-weight HTTP server, call `HTTPServer.execute` providing a root key in the `package.json` and a main function.

The function will be called with a `server` object, which has a `express` property to define routes.

```javascript
const apes = require("apes")

apes.HTTPServer.execute("confRoot.http", server => {
  // Do something here - Core logic goes here, by adding routes to server.express
})
```

## API Documentation

The API documentation can be found [here](https://shogunpanda.github.io/apes.js).

## Contributing to apes.js

- Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet.
- Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it.
- Fork the project.
- Start a feature/bugfix branch.
- Commit and push until you are happy with your contribution.
- Make sure to add tests for it. This is important so I don't break it in a future version unintentionally.

## Copyright

Copyright (C) 2016 and above Shogun <mailto:shogun@cowtech.it>.

Licensed under the MIT license, which can be found at https://choosealicense.com/licenses/mit.
