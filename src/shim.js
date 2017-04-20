/* eslint-env browser */

// http://stackoverflow.com/a/33268326/786644 - works in browser, worker, and Node.js
const globalVar = typeof window !== 'undefined' ? window :
    typeof WorkerGlobalScope !== 'undefined' ? self :
    typeof global !== 'undefined' ? global :
    Function('return this;')();

if (!globalVar.indexedDB) {
    globalVar.indexedDB = require('.');
    globalVar.IDBCursor = require('./FDBCursor').default;
    globalVar.IDBCursorWithValue = require('./FDBCursorWithValue').default;
    globalVar.IDBDatabase = require('./FDBDatabase').default;
    globalVar.IDBFactory = require('./FDBFactory').default;
    globalVar.IDBIndex = require('./FDBIndex').default;
    globalVar.IDBKeyRange = require('./FDBKeyRange').default;
    globalVar.IDBObjectStore = require('./FDBObjectStore').default;
    globalVar.IDBOpenDBRequest = require('./FDBOpenDBRequest').default;
    globalVar.IDBRequest = require('./FDBRequest').default;
    globalVar.IDBTransaction = require('./FDBTransaction').default;
    globalVar.IDBVersionChangeEvent = require('./FDBVersionChangeEvent').default;
}
