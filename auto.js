import fakeIndexedDB from "./build/fakeIndexedDB.js";
import FDBCursor from "./build/FDBCursor.js";
import FDBCursorWithValue from "./build/FDBCursorWithValue.js";
import FDBDatabase from "./build/FDBDatabase.js";
import FDBFactory from "./build/FDBFactory.js";
import FDBIndex from "./build/FDBIndex.js";
import FDBKeyRange from "./build/FDBKeyRange.js";
import FDBObjectStore from "./build/FDBObjectStore.js";
import FDBOpenDBRequest from "./build/FDBOpenDBRequest.js";
import FDBRequest from "./build/FDBRequest.js";
import FDBTransaction from "./build/FDBTransaction.js";
import FDBVersionChangeEvent from "./build/FDBVersionChangeEvent.js";

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
