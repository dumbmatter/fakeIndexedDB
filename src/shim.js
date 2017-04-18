/* eslint-env browser */

// http://stackoverflow.com/a/33268326/786644 - works in browser, worker, and Node.js
const globalVar = typeof window !== 'undefined' ? window :
    typeof WorkerGlobalScope !== 'undefined' ? self :
    typeof global !== 'undefined' ? global :
    Function('return this;')();

if (!globalVar.indexedDB) {
    globalVar.indexedDB = require('.');
    globalVar.IDBCursor = require('./FDBCursor');
    globalVar.IDBCursorWithValue = require('./FDBCursorWithValue');
    globalVar.IDBDatabase = require('./FDBDatabase');
    globalVar.IDBFactory = require('./FDBFactory');
    globalVar.IDBIndex = require('./FDBIndex');
    globalVar.IDBKeyRange = require('./FDBKeyRange');
    globalVar.IDBObjectStore = require('./FDBObjectStore');
    globalVar.IDBOpenDBRequest = require('./FDBOpenDBRequest');
    globalVar.IDBRequest = require('./FDBRequest');
    globalVar.IDBTransaction = require('./FDBTransaction');
    globalVar.IDBVersionChangeEvent = require('./FDBVersionChangeEvent');
}
