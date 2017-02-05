/*eslint-env node, browser */

'use strict';

self.fakeIndexedDB = require('.');
self.FDBCursor = require('./lib/FDBCursor');
self.FDBCursorWithValue = require('./lib/FDBCursorWithValue');
self.FDBDatabase = require('./lib/FDBDatabase');
self.FDBFactory = require('./lib/FDBFactory');
self.FDBIndex = require('./lib/FDBIndex');
self.FDBKeyRange = require('./lib/FDBKeyRange');
self.FDBObjectStore = require('./lib/FDBObjectStore');
self.FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
self.FDBRequest = require('./lib/FDBRequest');
self.FDBTransaction = require('./lib/FDBTransaction');
self.FDBVersionChangeEvent = require('./lib/FDBVersionChangeEvent');