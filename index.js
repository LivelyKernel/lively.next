export { default as Database } from "./database.js";
import { default as ObjectDB, ObjectDBInterface, ObjectDBHTTPInterface } from "./objectdb.js";
// to trigger resource extension
import "./storage-resource.js";
export { ObjectDB, ObjectDBInterface, ObjectDBHTTPInterface };
