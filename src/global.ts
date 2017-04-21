import fakeIndexedDB from "./fakeIndexedDB";
import FDBCursor from "./FDBCursor";
import FDBCursorWithValue from "./FDBCursorWithValue";
import FDBDatabase from "./FDBDatabase";
import FDBFactory from "./FDBFactory";
import FDBIndex from "./FDBIndex";
import FDBKeyRange from "./FDBKeyRange";
import FDBObjectStore from "./FDBObjectStore";
import FDBOpenDBRequest from "./FDBOpenDBRequest";
import FDBRequest from "./FDBRequest";
import FDBTransaction from "./FDBTransaction";
import FDBVersionChangeEvent from "./FDBVersionChangeEvent";

declare const WorkerGlobalScope: any;

// http://stackoverflow.com/a/33268326/786644 - works in browser, worker, and Node.js
const globalVar = typeof window !== "undefined" ? window :
    typeof WorkerGlobalScope !== "undefined" ? self :
    typeof global !== "undefined" ? global :
    Function("return this;")();

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
