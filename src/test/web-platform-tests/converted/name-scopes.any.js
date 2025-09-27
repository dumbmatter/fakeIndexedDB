import "../wpt-env.js";

let cursor,db,result,store,value;

globalThis.title = "IndexedDB: scoping for database / object store / index names, and index keys";

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
function transactionWatcher(testCase, transaction) {
  return new EventWatcher(testCase, transaction, ['abort', 'complete', 'error']);
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
//
// NB: be careful NOT to invoke this after the transaction may have already
// completed due to racing transaction auto-commit. A problematic sequence might
// look like:
//
//   const txn = db.transaction('store', 'readwrite');
//   txn.objectStore('store').put(value, key);
//   await foo();
//   await promiseForTransaction(t, txn);
function promiseForTransaction(testCase, transaction) {
  const eventWatcher = transactionWatcher(testCase, transaction);
  return eventWatcher.wait_for('complete');
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
  for (const record of BOOKS_RECORD_DATA)
      store.put(record);
  return store;
}

// Creates a 'books' object store whose contents closely resembles the first
// example in the IndexedDB specification, just without autoincrementing.
const createBooksStoreWithoutAutoIncrement = (testCase, database) => {
  const store = database.createObjectStore('books',
      { keyPath: 'isbn' });
  store.createIndex('by_author', 'author');
  store.createIndex('by_title', 'title', { unique: true });
  for (const record of BOOKS_RECORD_DATA)
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

// Returns an Uint8Array.
// When `seed` is non-zero, the data is pseudo-random, otherwise it is repetitive.
// The PRNG should be sufficient to defeat compression schemes, but it is not
// cryptographically strong.
function largeValue(size, seed) {
  const buffer = new Uint8Array(size);
  // Fill with a lot of the same byte.
  if (seed == 0) {
    buffer.fill(0x11, 0, size - 1);
    return buffer;
  }

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


// META: title=IndexedDB: scoping for database / object store / index names, and index keys
// META: global=window,worker
// META: script=resources/support-promises.js

// Spec: https://w3c.github.io/IndexedDB/#constructs

'use strict';

// Creates the structure inside a test database.
//
// The structure includes two stores with identical indexes and nearly-similar
// records. The records differ in the "path" attribute values, which are used to
// verify that IndexedDB returns the correct records when queried.
//
// databaseName appears redundant, but we don't want to rely on database.name.
const buildStores = (database, databaseName, useUniqueKeys) => {
  for (let storeName of ['x', 'y']) {
    const store = database.createObjectStore(
        storeName, {keyPath: 'pKey', autoIncrement: true});
    for (let indexName of ['x', 'y']) {
      store.createIndex(indexName, `${indexName}Key`, {unique: useUniqueKeys});
    }

    for (let xKeyRoot of ['x', 'y']) {
      for (let yKeyRoot of ['x', 'y']) {
        let xKey, yKey;
        if (useUniqueKeys) {
          xKey = `${xKeyRoot}${yKeyRoot}`;
          yKey = `${yKeyRoot}${xKeyRoot}`;
        } else {
          xKey = xKeyRoot;
          yKey = yKeyRoot;
        }
        const path = `${databaseName}-${storeName}-${xKeyRoot}-${yKeyRoot}`;
        store.put({xKey: xKey, yKey: yKey, path: path});
      }
    }
  }
};

// Creates two databases with identical structures.
const buildDatabases = (testCase, useUniqueKeys) => {
  return createNamedDatabase(
             testCase, 'x',
             database => buildStores(database, 'x', useUniqueKeys))
      .then(database => database.close())
      .then(
          () => createNamedDatabase(
              testCase, 'y',
              database => buildStores(database, 'y', useUniqueKeys)))
      .then(database => database.close());
};

// Reads all the store's values using an index.
//
// Returns a Promise that resolves with an array of values.
const readIndex =
    (testCase, index) => {
      return new Promise((resolve, reject) => {
        const results = [];
        const request = index.openCursor(IDBKeyRange.bound('a', 'z'), 'next');
        request.onsuccess = testCase.step_func(() => {
          const cursor = request.result;
          if (cursor) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        });
      });
    }

// Verifies that a database contains the expected records.
const checkDatabaseContent =
    (testCase, database, databaseName, usedUniqueKeys) => {
      const promises = [];
      const transaction = database.transaction(['x', 'y'], 'readonly');
      for (let storeName of ['x', 'y']) {
        const store = transaction.objectStore(storeName);
        for (let indexName of ['x', 'y']) {
          const index = store.index(indexName);

          const promise = readIndex(testCase, index).then((results) => {
            assert_array_equals(
                results.map(result => `${result.path}:${result.pKey}`).sort(),
                [
                  `${databaseName}-${storeName}-x-x:1`,
                  `${databaseName}-${storeName}-x-y:2`,
                  `${databaseName}-${storeName}-y-x:3`,
                  `${databaseName}-${storeName}-y-y:4`
                ],
                'The results should include all records put into the store');

            let expectedKeys = (usedUniqueKeys) ?
                ['xx:xx', 'xy:yx', 'yx:xy', 'yy:yy'] :
                ['x:x', 'x:y', 'y:x', 'y:y'];
            assert_array_equals(
                results.map(result => `${result.xKey}:${result.yKey}`).sort(),
                expectedKeys,
                'The results should include all the index keys put in the store');

            assert_array_equals(
                results.map(result => result[`${indexName}Key`]),
                results.map(result => result[`${indexName}Key`]).sort(),
                'The results should be sorted by the index key');
          });
          promises.push(promise);
        }
      }

      return Promise.all(promises).then(() => database);
    }

promise_test(testCase => {
  return buildDatabases(testCase, false)
      .then(() => openNamedDatabase(testCase, 'x', 1))
      .then(database => checkDatabaseContent(testCase, database, 'x', false))
      .then(database => database.close())
      .then(() => openNamedDatabase(testCase, 'y', 1))
      .then(database => checkDatabaseContent(testCase, database, 'y', false))
      .then(database => database.close());
}, 'Non-unique index keys');

promise_test(testCase => {
  return buildDatabases(testCase, true)
      .then(() => openNamedDatabase(testCase, 'x', 1))
      .then(database => checkDatabaseContent(testCase, database, 'x', true))
      .then(database => database.close())
      .then(() => openNamedDatabase(testCase, 'y', 1))
      .then(database => checkDatabaseContent(testCase, database, 'y', true))
      .then(database => database.close());
}, 'Unique index keys');
