import "../wpt-env.js";

'use strict';

// Returns an IndexedDB database name that is unique to the test case.
function databaseName(testCase) {
  return 'db' + self.location.pathname + '-' + testCase.name;
}

// EventWatcher covering all the events defined on IndexedDB requests.
//
// The events cover IDBRequest and IDBOpenDBRequest.
function requestWatcher(testCase, request) {
  return new EventWatcher(testCase, request,
                          ['blocked', 'error', 'success', 'upgradeneeded']);
}

// EventWatcher covering all the events defined on IndexedDB transactions.
//
// The events cover IDBTransaction.
function transactionWatcher(testCase, request) {
  return new EventWatcher(testCase, request, ['abort', 'complete', 'error']);
}

// Promise that resolves with an IDBRequest's result.
//
// The promise only resolves if IDBRequest receives the "success" event. Any
// other event causes the promise to reject with an error. This is correct in
// most cases, but insufficient for indexedDB.open(), which issues
// "upgradeneded" events under normal operation.
function promiseForRequest(testCase, request) {
  const eventWatcher = requestWatcher(testCase, request);
  return eventWatcher.wait_for('success').then(event => event.target.result);
}

// Promise that resolves when an IDBTransaction completes.
//
// The promise resolves with undefined if IDBTransaction receives the "complete"
// event, and rejects with an error for any other event.
function promiseForTransaction(testCase, request) {
  const eventWatcher = transactionWatcher(testCase, request);
  return eventWatcher.wait_for('complete').then(() => {});
}

// Migrates an IndexedDB database whose name is unique for the test case.
//
// newVersion must be greater than the database's current version.
//
// migrationCallback will be called during a versionchange transaction and will
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise. If the versionchange transaction goes through, the promise
// resolves to an IndexedDB database that should be closed by the caller. If the
// versionchange transaction is aborted, the promise resolves to an error.
function migrateDatabase(testCase, newVersion, migrationCallback) {
  return migrateNamedDatabase(
      testCase, databaseName(testCase), newVersion, migrationCallback);
}

// Migrates an IndexedDB database.
//
// newVersion must be greater than the database's current version.
//
// migrationCallback will be called during a versionchange transaction and will
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise. If the versionchange transaction goes through, the promise
// resolves to an IndexedDB database that should be closed by the caller. If the
// versionchange transaction is aborted, the promise resolves to an error.
function migrateNamedDatabase(
    testCase, databaseName, newVersion, migrationCallback) {
  // We cannot use eventWatcher.wait_for('upgradeneeded') here, because
  // the versionchange transaction auto-commits before the Promise's then
  // callback gets called.
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, newVersion);
    request.onupgradeneeded = testCase.step_func(event => {
      const database = event.target.result;
      const transaction = event.target.transaction;
      let shouldBeAborted = false;
      let requestEventPromise = null;

      // We wrap IDBTransaction.abort so we can set up the correct event
      // listeners and expectations if the test chooses to abort the
      // versionchange transaction.
      const transactionAbort = transaction.abort.bind(transaction);
      transaction.abort = () => {
        transaction._willBeAborted();
        transactionAbort();
      }
      transaction._willBeAborted = () => {
        requestEventPromise = new Promise((resolve, reject) => {
          request.onerror = event => {
            event.preventDefault();
            resolve(event.target.error);
          };
          request.onsuccess = () => reject(new Error(
              'indexedDB.open should not succeed for an aborted ' +
              'versionchange transaction'));
        });
        shouldBeAborted = true;
      }

      // If migration callback returns a promise, we'll wait for it to resolve.
      // This simplifies some tests.
      const callbackResult = migrationCallback(database, transaction, request);
      if (!shouldBeAborted) {
        request.onerror = null;
        request.onsuccess = null;
        requestEventPromise = promiseForRequest(testCase, request);
      }

      // requestEventPromise needs to be the last promise in the chain, because
      // we want the event that it resolves to.
      resolve(Promise.resolve(callbackResult).then(() => requestEventPromise));
    });
    request.onerror = event => reject(event.target.error);
    request.onsuccess = () => {
      const database = request.result;
      testCase.add_cleanup(() => { database.close(); });
      reject(new Error(
          'indexedDB.open should not succeed without creating a ' +
          'versionchange transaction'));
    };
  }).then(databaseOrError => {
    if (databaseOrError instanceof IDBDatabase)
      testCase.add_cleanup(() => { databaseOrError.close(); });
    return databaseOrError;
  });
}

// Creates an IndexedDB database whose name is unique for the test case.
//
// setupCallback will be called during a versionchange transaction, and will be
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function createDatabase(testCase, setupCallback) {
  return createNamedDatabase(testCase, databaseName(testCase), setupCallback);
}

// Creates an IndexedDB database.
//
// setupCallback will be called during a versionchange transaction, and will be
// given the created database, the versionchange transaction, and the database
// open request.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function createNamedDatabase(testCase, databaseName, setupCallback) {
  const request = indexedDB.deleteDatabase(databaseName);
  return promiseForRequest(testCase, request).then(() => {
    testCase.add_cleanup(() => { indexedDB.deleteDatabase(databaseName); });
    return migrateNamedDatabase(testCase, databaseName, 1, setupCallback)
  });
}

// Opens an IndexedDB database without performing schema changes.
//
// The given version number must match the database's current version.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function openDatabase(testCase, version) {
  return openNamedDatabase(testCase, databaseName(testCase), version);
}

// Opens an IndexedDB database without performing schema changes.
//
// The given version number must match the database's current version.
//
// Returns a promise that resolves to an IndexedDB database. The caller should
// close the database.
function openNamedDatabase(testCase, databaseName, version) {
  const request = indexedDB.open(databaseName, version);
  return promiseForRequest(testCase, request).then(database => {
    testCase.add_cleanup(() => { database.close(); });
    return database;
  });
}

// The data in the 'books' object store records in the first example of the
// IndexedDB specification.
const BOOKS_RECORD_DATA = [
  { title: 'Quarry Memories', author: 'Fred', isbn: 123456 },
  { title: 'Water Buffaloes', author: 'Fred', isbn: 234567 },
  { title: 'Bedrock Nights', author: 'Barney', isbn: 345678 },
];

// Creates a 'books' object store whose contents closely resembles the first
// example in the IndexedDB specification.
const createBooksStore = (testCase, database) => {
  const store = database.createObjectStore('books',
      { keyPath: 'isbn', autoIncrement: true });
  store.createIndex('by_author', 'author');
  store.createIndex('by_title', 'title', { unique: true });
  for (let record of BOOKS_RECORD_DATA)
      store.put(record);
  return store;
}

// Creates a 'not_books' object store used to test renaming into existing or
// deleted store names.
function createNotBooksStore(testCase, database) {
  const store = database.createObjectStore('not_books');
  store.createIndex('not_by_author', 'author');
  store.createIndex('not_by_title', 'title', { unique: true });
  return store;
}

// Verifies that an object store's indexes match the indexes used to create the
// books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkStoreIndexes (testCase, store, errorMessage) {
  assert_array_equals(
      store.indexNames, ['by_author', 'by_title'], errorMessage);
  const authorIndex = store.index('by_author');
  const titleIndex = store.index('by_title');
  return Promise.all([
      checkAuthorIndexContents(testCase, authorIndex, errorMessage),
      checkTitleIndexContents(testCase, titleIndex, errorMessage),
  ]);
}

// Verifies that an object store's key generator is in the same state as the
// key generator created for the books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkStoreGenerator(testCase, store, expectedKey, errorMessage) {
  const request = store.put(
      { title: 'Bedrock Nights ' + expectedKey, author: 'Barney' });
  return promiseForRequest(testCase, request).then(result => {
    assert_equals(result, expectedKey, errorMessage);
  });
}

// Verifies that an object store's contents matches the contents used to create
// the books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkStoreContents(testCase, store, errorMessage) {
  const request = store.get(123456);
  return promiseForRequest(testCase, request).then(result => {
    assert_equals(result.isbn, BOOKS_RECORD_DATA[0].isbn, errorMessage);
    assert_equals(result.author, BOOKS_RECORD_DATA[0].author, errorMessage);
    assert_equals(result.title, BOOKS_RECORD_DATA[0].title, errorMessage);
  });
}

// Verifies that index matches the 'by_author' index used to create the
// by_author books store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkAuthorIndexContents(testCase, index, errorMessage) {
  const request = index.get(BOOKS_RECORD_DATA[2].author);
  return promiseForRequest(testCase, request).then(result => {
    assert_equals(result.isbn, BOOKS_RECORD_DATA[2].isbn, errorMessage);
    assert_equals(result.title, BOOKS_RECORD_DATA[2].title, errorMessage);
  });
}

// Verifies that an index matches the 'by_title' index used to create the books
// store in the test database's version 1.
//
// The errorMessage is used if the assertions fail. It can state that the
// IndexedDB implementation being tested is incorrect, or that the testing code
// is using it incorrectly.
function checkTitleIndexContents(testCase, index, errorMessage) {
  const request = index.get(BOOKS_RECORD_DATA[2].title);
  return promiseForRequest(testCase, request).then(result => {
    assert_equals(result.isbn, BOOKS_RECORD_DATA[2].isbn, errorMessage);
    assert_equals(result.author, BOOKS_RECORD_DATA[2].author, errorMessage);
  });
}

// Returns an Uint8Array with pseudorandom data.
//
// The PRNG should be sufficient to defeat compression schemes, but it is not
// cryptographically strong.
function largeValue(size, seed) {
  const buffer = new Uint8Array(size);

  // 32-bit xorshift - the seed can't be zero
  let state = 1000 + seed;

  for (let i = 0; i < size; ++i) {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    buffer[i] = state & 0xff;
  }

  return buffer;
}

async function deleteAllDatabases(testCase) {
  const dbs_to_delete = await indexedDB.databases();
  for( const db_info of dbs_to_delete) {
    let request = indexedDB.deleteDatabase(db_info.name);
    let eventWatcher = requestWatcher(testCase, request);
    await eventWatcher.wait_for('success');
  }
}

// Keeps the passed transaction alive indefinitely (by making requests
// against the named store). Returns a function that asserts that the
// transaction has not already completed and then ends the request loop so that
// the transaction may autocommit and complete.
function keepAlive(testCase, transaction, storeName) {
  let completed = false;
  transaction.addEventListener('complete', () => { completed = true; });

  let keepSpinning = true;

  function spin() {
    if (!keepSpinning)
      return;
    transaction.objectStore(storeName).get(0).onsuccess = spin;
  }
  spin();

  return testCase.step_func(() => {
    assert_false(completed, 'Transaction completed while kept alive');
    keepSpinning = false;
  });
}

// Return a promise that resolves after a setTimeout finishes to break up the
// scope of a function's execution.
function timeoutPromise(ms) {
  return new Promise(resolve => { setTimeout(resolve, ms); });
}


// META: title=Indexed DB and Structured Serializing/Deserializing
// META: timeout=long
// META: script=support-promises.js
// META: script=/common/subset-tests.js
// META: variant=?1-20
// META: variant=?21-40
// META: variant=?41-60
// META: variant=?61-80
// META: variant=?81-100
// META: variant=?101-last

// Tests Indexed DB coverage of HTML's Safe "passing of structured data"
// https://html.spec.whatwg.org/multipage/structured-data.html

function describe(value) {
  let type, str;
  if (typeof value === 'object' && value) {
    type = value.__proto__.constructor.name;
    // Handle Number(-0), etc.
    str = Object.is(value.valueOf(), -0) ? '-0' : String(value);
  } else {
    type = typeof value;
    // Handle primitive -0.
    str = Object.is(value, -0) ? '-0' : String(value);
  }
  return `${type}: ${str}`;
}

function cloneTest(value, verifyFunc) {
  subsetTest(promise_test, async t => {
    const db = await createDatabase(t, db => {
      const store = db.createObjectStore('store');
      // This index is not used, but evaluating key path on each put()
      // call will exercise (de)serialization.
      store.createIndex('index', 'dummyKeyPath');
    });
    t.add_cleanup(() => {
      if (db) {
        db.close();
        indexedDB.deleteDatabase(db.name);
      }
    });
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');
    await promiseForRequest(t, store.put(value, 'key'));
    const result = await promiseForRequest(t, store.get('key'));
    await verifyFunc(value, result);
    await promiseForTransaction(t, tx);
  }, describe(value));
}

// Specialization of cloneTest() for objects, with common asserts.
function cloneObjectTest(value, verifyFunc) {
  cloneTest(value, async (orig, clone) => {
    assert_not_equals(orig, clone);
    assert_equals(typeof clone, 'object');
    assert_equals(orig.__proto__, clone.__proto__);
    await verifyFunc(orig, clone);
  });
}

function cloneFailureTest(value) {
  subsetTest(promise_test, async t => {
    const db = await createDatabase(t, db => {
      db.createObjectStore('store');
    });
    t.add_cleanup(() => {
      if (db) {
        db.close();
        indexedDB.deleteDatabase(db.name);
      }
    });
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');
    assert_throws_dom('DataCloneError', () => store.put(value, 'key'));
  }, 'Not serializable: ' + describe(value));
}

//
// ECMAScript types
//

// Primitive values: Undefined, Null, Boolean, Number, BigInt, String
const booleans = [false, true];
const numbers = [
  NaN,
  -Infinity,
  -Number.MAX_VALUE,
  -0xffffffff,
  -0x80000000,
  -0x7fffffff,
  -1,
  -Number.MIN_VALUE,
  -0,
  0,
  1,
  Number.MIN_VALUE,
  0x7fffffff,
  0x80000000,
  0xffffffff,
  Number.MAX_VALUE,
  Infinity,
];
const bigints = [
  -12345678901234567890n,
  -1n,
  0n,
  1n,
  12345678901234567890n,
];
const strings = [
  '',
  'this is a sample string',
  'null(\0)',
];

[undefined, null].concat(booleans, numbers, bigints, strings)
  .forEach(value => cloneTest(value, (orig, clone) => {
    assert_equals(orig, clone);
  }));

// "Primitive" Objects (Boolean, Number, BigInt, String)
[].concat(booleans, numbers, strings)
  .forEach(value => cloneObjectTest(Object(value), (orig, clone) => {
    assert_equals(orig.valueOf(), clone.valueOf());
  }));

// Dates
[
  new Date(-1e13),
  new Date(-1e12),
  new Date(-1e9),
  new Date(-1e6),
  new Date(-1e3),
  new Date(0),
  new Date(1e3),
  new Date(1e6),
  new Date(1e9),
  new Date(1e12),
  new Date(1e13)
].forEach(value => cloneTest(value, (orig, clone) => {
    assert_not_equals(orig, clone);
    assert_equals(typeof clone, 'object');
    assert_equals(orig.__proto__, clone.__proto__);
    assert_equals(orig.valueOf(), clone.valueOf());
  }));

// Regular Expressions
[
  new RegExp(),
  /abc/,
  /abc/g,
  /abc/i,
  /abc/gi,
  /abc/m,
  /abc/mg,
  /abc/mi,
  /abc/mgi,
  /abc/gimsuy,
].forEach(value => cloneObjectTest(value, (orig, clone) => {
  assert_equals(orig.toString(), clone.toString());
}));

// ArrayBuffer
cloneObjectTest(new Uint8Array([0, 1, 254, 255]).buffer, (orig, clone) => {
  assert_array_equals(new Uint8Array(orig), new Uint8Array(clone));
});

// TODO SharedArrayBuffer

// Array Buffer Views
[
  new Uint8Array([]),
  new Uint8Array([0, 1, 254, 255]),
  new Uint16Array([0x0000, 0x0001, 0xFFFE, 0xFFFF]),
  new Uint32Array([0x00000000, 0x00000001, 0xFFFFFFFE, 0xFFFFFFFF]),
  new Int8Array([0, 1, 254, 255]),
  new Int16Array([0x0000, 0x0001, 0xFFFE, 0xFFFF]),
  new Int32Array([0x00000000, 0x00000001, 0xFFFFFFFE, 0xFFFFFFFF]),
  new Uint8ClampedArray([0, 1, 254, 255]),
  new Float32Array([-Infinity, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, Infinity, NaN]),
  new Float64Array([-Infinity, -Number.MAX_VALUE, -Number.MIN_VALUE, 0,
                    Number.MIN_VALUE, Number.MAX_VALUE, Infinity, NaN])
].forEach(value => cloneObjectTest(value, (orig, clone) => {
  assert_array_equals(orig, clone);
}));

// Map
cloneObjectTest(new Map([[1,2],[3,4]]), (orig, clone) => {
  assert_array_equals([...orig.keys()], [...clone.keys()]);
  assert_array_equals([...orig.values()], [...clone.values()]);
});

// Set
cloneObjectTest(new Set([1,2,3,4]), (orig, clone) => {
  assert_array_equals([...orig.values()], [...clone.values()]);
});

// Error
[
  new Error(),
  new Error('abc', 'def'),
  new EvalError(),
  new EvalError('ghi', 'jkl'),
  new RangeError(),
  new RangeError('ghi', 'jkl'),
  new ReferenceError(),
  new ReferenceError('ghi', 'jkl'),
  new SyntaxError(),
  new SyntaxError('ghi', 'jkl'),
  new TypeError(),
  new TypeError('ghi', 'jkl'),
  new URIError(),
  new URIError('ghi', 'jkl'),
].forEach(value => cloneObjectTest(value, (orig, clone) => {
  assert_equals(orig.name, clone.name);
  assert_equals(orig.message, clone.message);
}));

// Arrays
[
  [],
  [1,2,3],
  Object.assign(
    ['foo', 'bar'],
    {10: true, 11: false, 20: 123, 21: 456, 30: null}),
  Object.assign(
    ['foo', 'bar'],
    {a: true, b: false, foo: 123, bar: 456, '': null}),
].forEach(value => cloneObjectTest(value, (orig, clone) => {
  assert_array_equals(orig, clone);
  assert_array_equals(Object.keys(orig), Object.keys(clone));
  Object.keys(orig).forEach(key => {
    assert_equals(orig[key], clone[key], `Property ${key}`);
  });
}));

// Objects
cloneObjectTest({foo: true, bar: false}, (orig, clone) => {
  assert_array_equals(Object.keys(orig), Object.keys(clone));
  Object.keys(orig).forEach(key => {
    assert_equals(orig[key], clone[key], `Property ${key}`);
  });
});

//
// [Serializable] Platform objects
//

// TODO: Test these additional interfaces:
// * DOMQuad
// * DOMException
// * RTCCertificate

// Geometry types
[
  new DOMMatrix(),
  new DOMMatrixReadOnly(),
  new DOMPoint(),
  new DOMPointReadOnly(),
  new DOMRect,
  new DOMRectReadOnly(),
].forEach(value => cloneObjectTest(value, (orig, clone) => {
  Object.keys(orig.__proto__).forEach(key => {
    assert_equals(orig[key], clone[key], `Property ${key}`);
  });
}));

// ImageData
const image_data = new ImageData(8, 8);
for (let i = 0; i < 256; ++i) {
  image_data.data[i] = i;
}
cloneObjectTest(image_data, (orig, clone) => {
  assert_equals(orig.width, clone.width);
  assert_equals(orig.height, clone.height);
  assert_array_equals(orig.data, clone.data);
});

// Blob
cloneObjectTest(
  new Blob(['This is a test.'], {type: 'a/b'}),
  async (orig, clone) => {
    assert_equals(orig.size, clone.size);
    assert_equals(orig.type, clone.type);
    assert_equals(await orig.text(), await clone.text());
  });

// File
cloneObjectTest(
  new File(['This is a test.'], 'foo.txt', {type: 'c/d'}),
  async (orig, clone) => {
    assert_equals(orig.size, clone.size);
    assert_equals(orig.type, clone.type);
    assert_equals(orig.name, clone.name);
    assert_equals(orig.lastModified, clone.lastModified);
    assert_equals(await orig.text(), await clone.text());
  });


// FileList - exposed in Workers, but not constructable.
if ('document' in self) {
  // TODO: Test with populated list.
  cloneObjectTest(
    Object.assign(document.createElement('input'),
                  {type: 'file', multiple: true}).files,
    async (orig, clone) => {
      assert_equals(orig.length, clone.length);
    });
}

//
// Non-serializable types
//
[
  // ECMAScript types
  function() {},
  Symbol('desc'),

  // Non-[Serializable] platform objects
  self,
  new Event(''),
  new MessageChannel()
].forEach(cloneFailureTest);
