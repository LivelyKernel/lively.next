import HttpResource from './http-resource.js';
import Resource from "./resource.js";

/*
  This is a resource that encapsulates the management of an S3 endpoint.
  This is not only restricted to amazon.s3 but any other storage provider that conform to S3
  of which there are now many more, such as DigitalOcean Spaces, etc.

  lively.resources evaluates to S3Resource automatically by prefixing the url with s3://
  Internally S3Resources manages a plain HttpResource to which it dispatches the approriate HTTP(S) requests as needed.
*/

export default class S3Resource extends Resource {

  // todo: intercept the initialization and add in https by default to the url
  
  async read() {
    
  }
  
  async write() {
    
  }
  
  async mkdir() {
    
  }
  
  async exists() {
    
  }
  
  async remove() {
    
  }
  
  async dirList(depth, opts) {
    
  }
  
  async readProperties(opts) {
    
  }
  
}