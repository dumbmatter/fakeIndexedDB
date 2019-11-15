var fakeIndexedDB = require("./build/fakeIndexedDB").default;
var FDBCursor = require("./build/FDBCursor").default;
var FDBCursorWithValue = require("./build/FDBCursorWithValue").default;
var FDBDatabase = require("./build/FDBDatabase").default;
var FDBFactory = require("./build/FDBFactory").default;
var FDBIndex = require("./build/FDBIndex").default;
var FDBKeyRange = require("./build/FDBKeyRange").default;
var FDBObjectStore = require("./build/FDBObjectStore").default;
var FDBOpenDBRequest = require("./build/FDBOpenDBRequest").default;
var FDBRequest = require("./build/FDBRequest").default;
var FDBTransaction = require("./build/FDBTransaction").default;
var FDBVersionChangeEvent = require("./build/FDBVersionChangeEvent").default;

// http://stackoverflow.com/a/33268326/786644 - works in browser, worker, and Node.js
var globalVar =
    typeof window !== "undefined"
        ? window
        : typeof WorkerGlobalScope !== "undefined"
        ? self
        : typeof global !== "undefined"
        ? global
        : Function("return this;")();

globalVar.indexedDB = fakeIndexedDB;
globalVar.IDBCursor = FDBCursor;
globalVar.IDBCursorWithValue = FDBCursorWithValue;
globalVar.IDBDatabase = FDBDatabase;
globalVar.IDBFactory = FDBFactory;
globalVar.IDBIndex = FDBIndex;
globalVar.IDBKeyRange = FDBKeyRange;
globalVar.IDBObjectStore = FDBObjectStore;
globalVar.IDBOpenDBRequest = FDBOpenDBRequest;
globalVar.IDBRequest = FDBRequest;
globalVar.IDBTransaction = FDBTransaction;
globalVar.IDBVersionChangeEvent = FDBVersionChangeEvent;
