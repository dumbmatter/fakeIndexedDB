'use strict';

require('phantomjs-polyfill')
require('setimmediate');
require('es6-shim');

window.fakeIndexedDB = require('.');
window.FDBCursor = require('./lib/FDBCursor');
window.FDBCursorWithValue = require('./lib/FDBCursorWithValue');
window.FDBDatabase = require('./lib/FDBDatabase');
window.FDBFactory = require('./lib/FDBFactory');
window.FDBIndex = require('./lib/FDBIndex');
window.FDBKeyRange = require('./lib/FDBKeyRange');
window.FDBObjectStore = require('./lib/FDBObjectStore');
window.FDBOpenDBRequest = require('./lib/FDBOpenDBRequest');
window.FDBRequest = require('./lib/FDBRequest');
window.FDBTransaction = require('./lib/FDBTransaction');
window.FDBVersionChangeEvent = require('./lib/FDBVersionChangeEvent');