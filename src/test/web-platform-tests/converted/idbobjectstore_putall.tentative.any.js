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


// META: script=support-promises.js

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const values = [
    {isbn: 'one', title: 'title1'},
    {isbn: 'two', title: 'title2'},
    {isbn: 'three', title: 'title3'}
  ];
  const putAllRequest = objectStore.putAllValues(values);
  // TODO(nums): Check that correct keys are returned.
  await promiseForRequest(testCase, putAllRequest);
  await promiseForTransaction(testCase, txn);

  const txn2 = db.transaction(['books'], 'readonly');
  const objectStore2 = txn2.objectStore('books');
  const getRequest1 = objectStore2.get('one');
  const getRequest2 = objectStore2.get('two');
  const getRequest3 = objectStore2.get('three');
  await promiseForTransaction(testCase, txn2);
  assert_array_equals(
      [getRequest1.result.title,
          getRequest2.result.title,
          getRequest3.result.title],
      ['title1', 'title2', 'title3'],
      'All three retrieved titles should match those that were put.');
  db.close();
}, 'Data can be successfully inserted into an object store using putAll.');

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const values = [
    {isbn: ['one', 'two', 'three'], title: 'title1'},
    {isbn: ['four', 'five', 'six'], title: 'title2'},
    {isbn: ['seven', 'eight', 'nine'], title: 'title3'}
  ];
  const putAllRequest = objectStore.putAllValues(values);
  // TODO(nums): Check that correct keys are returned.
  await promiseForRequest(testCase, putAllRequest);
  await promiseForTransaction(testCase, txn);

  const txn2 = db.transaction(['books'], 'readonly');
  const objectStore2 = txn2.objectStore('books');
  const getRequest1 = objectStore2.get(['one', 'two', 'three']);
  const getRequest2 = objectStore2.get(['four', 'five', 'six']);
  const getRequest3 = objectStore2.get(['seven', 'eight', 'nine']);
  await promiseForTransaction(testCase, txn2);
  assert_array_equals(
      [getRequest1.result.title,
          getRequest2.result.title,
          getRequest3.result.title],
      ['title1', 'title2', 'title3'],
      'All three retrieved titles should match those that were put.');
  db.close();
}, 'Values with array keys can be successfully inserted into an object'
    + ' store using putAll.');

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const putAllRequest = objectStore.putAllValues([]);
  await promiseForRequest(testCase, putAllRequest);
  await promiseForTransaction(testCase, txn);
  // TODO(nums): Check that an empty key array is returned.
  db.close();
}, 'Inserting an empty list using putAll.');

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const putAllRequest = objectStore.putAllValues([{}, {}, {}]);
  // TODO(nums): Check that correct keys are returned.
  await promiseForRequest(testCase, putAllRequest);
  await promiseForTransaction(testCase, txn);

  const txn2 = db.transaction(['books'], 'readonly');
  const objectStore2 = txn2.objectStore('books');
  const getRequest1 = objectStore2.get(1);
  const getRequest2 = objectStore2.get(2);
  const getRequest3 = objectStore2.get(3);
  await Promise.all([
    promiseForRequest(testCase, getRequest1),
    promiseForRequest(testCase, getRequest2),
    promiseForRequest(testCase, getRequest3),
  ]);
  db.close();
}, 'Empty values can be inserted into an objectstore'
    + ' with a key generator using putAll.');

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readonly');
  const objectStore = txn.objectStore('books');
  assert_throws_dom('ReadOnlyError',
    () => { objectStore.putAllValues([{}]); },
    'The transaction is readonly');
  db.close();
}, 'Attempting to insert with a read only transaction using putAll throws a '
    + 'ReadOnlyError.');

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStore(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const putRequest = await objectStore.put({isbn: 1, title: "duplicate"});
  await promiseForRequest(testCase, putRequest);
  const putAllRequest = objectStore.putAllValues([
    {isbn: 2, title: "duplicate"},
    {isbn: 3, title: "duplicate"}
  ]);
  const errorEvent = await requestWatcher(testCase,
                                        putAllRequest).wait_for('error');
  assert_equals(errorEvent.target.error.name, "ConstraintError");
  errorEvent.preventDefault();
  // The transaction still receives the error event even though it
  // isn't aborted.
  await transactionWatcher(testCase, txn).wait_for(['error', 'complete']);

  const txn2 = db.transaction(['books'], 'readonly');
  const objectStore2 = txn2.objectStore('books');
  const getRequest1 = objectStore2.get(1);
  const getRequest2 = objectStore2.get(2);
  const getRequest3 = objectStore2.get(3);
  await promiseForTransaction(testCase, txn2);
  assert_array_equals(
      [getRequest1.result.title, getRequest2.result, getRequest3.result],
      ["duplicate", undefined, undefined],
      'None of the values should have been inserted.');
  db.close();
}, 'Inserting duplicate unique keys into a store that already has the key'
    + 'using putAll throws a ConstraintError.');

promise_test(async testCase => {
  const db = await createDatabase(testCase, db => {
    const store = createBooksStoreWithoutAutoIncrement(testCase, db);
  });
  const txn = db.transaction(['books'], 'readwrite');
  const objectStore = txn.objectStore('books');
  const values = [
    {title: "title1", isbn: 1},
    {title: "title2"}
  ];
  assert_throws_dom('DataError',
    () => { const putAllRequest = objectStore.putAllValues(values); },
    "Evaluating the object store's key path did not yield a value");

  const txn2 = db.transaction(['books'], 'readonly');
  const objectStore2 = txn2.objectStore('books');
  const getRequest1 = objectStore2.get(1);
  const getRequest2 = objectStore2.get(2);
  await promiseForTransaction(testCase, txn2);
  assert_array_equals(
      [getRequest1.result, getRequest2.result],
      [undefined, undefined],
      'No data should have been inserted');
  db.close();
}, 'Inserting values without the key into an object store that'
    + ' does not have generated keys throws an exception.');

// TODO(nums): Add test for insertion into multi entry indexes
// TODO(nums): Add test for inserting unique keys into a store
// that doesn't already have the key https://crbug.com/1115649
