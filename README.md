# apes.js

[![Package Version](https://badge.fury.io/js/apes.png)](http://badge.fury.io/js/apes)
[![Dependency Status](https://gemnasium.com/ShogunPanda/apes.js.png?travis)](https://gemnasium.com/ShogunPanda/apes.js)
[![Build Status](https://secure.travis-ci.org/ShogunPanda/apes.js.png?branch=master)](http://travis-ci.org/ShogunPanda/apes.js)
[![Coverage Status](https://coveralls.io/repos/github/ShogunPanda/apes.js/badge.svg?branch=master)](https://coveralls.io/github/ShogunPanda/apes.js?branch=master)

A tiny application and HTTP API framework for Express.js.

https://sw.cowtech.it/apes.js

## Supported implementations.

apes.js is written in [TypeScript](https://typescriptlang.org). 

It can be used in TypeScript (using Typescript 2.0) or simply in plain Javacript.

It supports and has been tested on [NodeJS](http://nodejs.org) 6.0+.

## Usage

### Standalone application

To create a Node.js application which already takes care of logging, extend the `Application` class and override its `prepare`, `execute` and `cleanup` methods.

Then, instantiate the class and call it's `run` method.
 
```javascript
const apes = require(apes);

class CustomApplication extends apes.Application{
  prepare(){
    // Do something here
  }

  execute(){
    // Do something here - Core logic goes here.
  }

  cleanup(){
    // Do something here
  }
}

new CustomApplication().run();
```

### HTTP Server

To create a fully working light-weight HTTP server, extend the `HTTPServer` class and override its `addRoutes` and `addMiddlewares` methods.

Then, instantiate the class and call it's `run` method.

```javascript
const apes = require(apes);

class CustomServer extends apes.HTTP.Server{
  addRoutes(){
    // Do something here - Core logic goes here.
  }

  addMiddlewares(){
    // Do something here - Optional
  }
}

new CustomServer().run();
```

## API Documentation

The API documentation can be found [here](https://shogunpanda.github.io/apes.js).

## Contributing to apes.js

* Check out the latest master to make sure the feature hasn't been implemented or the bug hasn't been fixed yet.
* Check out the issue tracker to make sure someone already hasn't requested it and/or contributed it.
* Fork the project.
* Start a feature/bugfix branch.
* Commit and push until you are happy with your contribution.
* Make sure to add tests for it. This is important so I don't break it in a future version unintentionally.

## Copyright

Copyright (C) 2016 and above Shogun <shogun@cowtech.it>.

Licensed under the MIT license, which can be found at http://opensource.org/licenses/MIT.
