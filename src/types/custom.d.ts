// Declaration for 'cors' module
declare module 'cors' {
  import * as express from 'express';
  function cors(options?: any): express.RequestHandler;
  export = cors;
}

// Declaration for 'express' module
declare module 'express' {
  import * as http from 'http';
  import * as core from 'express-serve-static-core';
  import * as qs from 'qs';

  // Type definitions for express
  namespace Express {
    interface Request {
      body?: any;
      params?: { [key: string]: string };
      query?: { [key: string]: string | string[] };
    }

    interface Response {
      json(data?: any): this;
      send(data?: any): this;
      status(code: number): this;
    }
  }

  function express(): core.Express;
  export = express;
}
