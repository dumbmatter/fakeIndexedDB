import "../wpt-env.js";

let attrs,cursor,db,store,store2;

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


/* Delete created databases
 *
 * Go through each finished test, see if it has an associated database. Close
 * that and delete the database. */
add_completion_callback(function(tests)
{
    for (var i in tests)
    {
        if(tests[i].db)
        {
            tests[i].db.close();
            self.indexedDB.deleteDatabase(tests[i].db.name);
        }
    }
});

function fail(test, desc) {
    return test.step_func(function(e) {
        if (e && e.message && e.target.error)
            assert_unreached(desc + " (" + e.target.error.name + ": " + e.message + ")");
        else if (e && e.message)
            assert_unreached(desc + " (" + e.message + ")");
        else if (e && e.target.readyState === 'done' && e.target.error)
            assert_unreached(desc + " (" + e.target.error.name + ")");
        else
            assert_unreached(desc);
    });
}

function createdb(test, dbname, version)
{
    var rq_open = createdb_for_multiple_tests(dbname, version);
    return rq_open.setTest(test);
}

function createdb_for_multiple_tests(dbname, version) {
    var rq_open,
        fake_open = {},
        test = null,
        dbname = (dbname ? dbname : "testdb-" + new Date().getTime() + Math.random() );

    if (version)
        rq_open = self.indexedDB.open(dbname, version);
    else
        rq_open = self.indexedDB.open(dbname);

    function auto_fail(evt, current_test) {
        /* Fail handlers, if we haven't set on/whatever/, don't
         * expect to get event whatever. */
        rq_open.manually_handled = {};

        rq_open.addEventListener(evt, function(e) {
            if (current_test !== test) {
                return;
            }

            test.step(function() {
                if (!rq_open.manually_handled[evt]) {
                    assert_unreached("unexpected open." + evt + " event");
                }

                if (e.target.result + '' == '[object IDBDatabase]' &&
                    !this.db) {
                  this.db = e.target.result;

                  this.db.onerror = fail(test, 'unexpected db.error');
                  this.db.onabort = fail(test, 'unexpected db.abort');
                  this.db.onversionchange =
                      fail(test, 'unexpected db.versionchange');
                }
            });
        });
        rq_open.__defineSetter__("on" + evt, function(h) {
            rq_open.manually_handled[evt] = true;
            if (!h)
                rq_open.addEventListener(evt, function() {});
            else
                rq_open.addEventListener(evt, test.step_func(h));
        });
    }

    // add a .setTest method to the IDBOpenDBRequest object
    Object.defineProperty(rq_open, 'setTest', {
        enumerable: false,
        value: function(t) {
            test = t;

            auto_fail("upgradeneeded", test);
            auto_fail("success", test);
            auto_fail("blocked", test);
            auto_fail("error", test);

            return this;
        }
    });

    return rq_open;
}

function assert_key_equals(actual, expected, description) {
  assert_equals(indexedDB.cmp(actual, expected), 0, description);
}

// Usage:
//   indexeddb_test(
//     (test_object, db_connection, upgrade_tx, open_request) => {
//        // Database creation logic.
//     },
//     (test_object, db_connection, open_request) => {
//        // Test logic.
//        test_object.done();
//     },
//     'Test case description');
function indexeddb_test(upgrade_func, open_func, description, options) {
  async_test(function(t) {
    options = Object.assign({upgrade_will_abort: false}, options);
    var dbname = location + '-' + t.name;
    var del = indexedDB.deleteDatabase(dbname);
    del.onerror = t.unreached_func('deleteDatabase should succeed');
    var open = indexedDB.open(dbname, 1);
    open.onupgradeneeded = t.step_func(function() {
      var db = open.result;
      t.add_cleanup(function() {
        // If open didn't succeed already, ignore the error.
        open.onerror = function(e) {
          e.preventDefault();
        };
        db.close();
        indexedDB.deleteDatabase(db.name);
      });
      var tx = open.transaction;
      upgrade_func(t, db, tx, open);
    });
    if (options.upgrade_will_abort) {
      open.onsuccess = t.unreached_func('open should not succeed');
    } else {
      open.onerror = t.unreached_func('open should succeed');
      open.onsuccess = t.step_func(function() {
        var db = open.result;
        if (open_func)
          open_func(t, db, open);
      });
    }
  }, description);
}

// Call with a Test and an array of expected results in order. Returns
// a function; call the function when a result arrives and when the
// expected number appear the order will be asserted and test
// completed.
function expect(t, expected) {
  var results = [];
  return result => {
    results.push(result);
    if (results.length === expected.length) {
      assert_array_equals(results, expected);
      t.done();
    }
  };
}

// Checks to see if the passed transaction is active (by making
// requests against the named store).
function is_transaction_active(tx, store_name) {
  try {
    const request = tx.objectStore(store_name).get(0);
    request.onerror = e => {
      e.preventDefault();
      e.stopPropagation();
    };
    return true;
  } catch (ex) {
    assert_equals(ex.name, 'TransactionInactiveError',
                  'Active check should either not throw anything, or throw ' +
                  'TransactionInactiveError');
    return false;
  }
}

// Keeps the passed transaction alive indefinitely (by making requests
// against the named store). Returns a function that asserts that the
// transaction has not already completed and then ends the request loop so that
// the transaction may autocommit and complete.
function keep_alive(tx, store_name) {
  let completed = false;
  tx.addEventListener('complete', () => { completed = true; });

  let keepSpinning = true;

  function spin() {
    if (!keepSpinning)
      return;
    tx.objectStore(store_name).get(0).onsuccess = spin;
  }
  spin();

  return () => {
    assert_false(completed, 'Transaction completed while kept alive');
    keepSpinning = false;
  };
}

// Returns a new function. After it is called |count| times, |func|
// will be called.
function barrier_func(count, func) {
  let n = 0;
  return () => {
    if (++n === count)
      func();
  };
}

// Create an IndexedDB by executing script on the given remote context
// with |dbName| and |version|.
async function createIndexedDBForTesting(rc, dbName, version) {
  await rc.executeScript((dbName, version) => {
    let request = indexedDB.open(dbName, version);
    request.onupgradeneeded = () => {
      if (version == 1) {
        // Only create the object store once.
        request.result.createObjectStore('store');
      }
    }
    request.onversionchange = () => {
      fail(t, 'unexpectedly received versionchange event.');
    }
  }, [dbName, version]);
}

// Create an IndexedDB by executing script on the given remote context
// with |dbName| and |version|, and wait for the reuslt.
async function waitUntilIndexedDBOpenForTesting(rc, dbName, version) {
  await rc.executeScript(async (dbName, version) => {
    await new Promise((resolve, reject) => {
        let request = indexedDB.open(dbName, version);
        request.onsuccess = resolve;
        request.onerror = reject;
    });
  }, [dbName, version]);
}

// Returns a detached ArrayBuffer by transferring it to a message port.
function createDetachedArrayBuffer() {
  const array = new Uint8Array([1, 2, 3, 4]);
  const buffer = array.buffer;
  assert_equals(array.byteLength, 4);

  const channel = new MessageChannel();
  channel.port1.postMessage('', [buffer]);
  assert_equals(array.byteLength, 0);
  return array;
}



// Should be large enough to trigger large value handling in the IndexedDB
// engines that have special code paths for large values.
const wrapThreshold = 128 * 1024;

function populateStore(store) {
  store.put({id: 1, key: 'k1', value: largeValue(wrapThreshold, 1)});
  store.put({id: 2, key: 'k2', value: ['small-2']});
  store.put({id: 3, key: 'k3', value: largeValue(wrapThreshold, 3)});
  store.put({id: 4, key: 'k4', value: ['small-4']});
}

// Assigns cursor indexes for operations that require open cursors.
//
// Returns the number of open cursors required to perform all operations.
function assignCursors(operations) {
  return cursorCount;
}

// Opens index cursors for operations that require open cursors.
//
// onsuccess is called if all cursors are opened successfully. Otherwise,
// onerror will be called at least once.
function openCursors(testCase, index, operations, onerror, onsuccess) {
  let pendingCursors = 0;

  for (let operation of operations) {
    const opcode = operation[0];
    const primaryKey = operation[1];
    let request;
    switch (opcode) {
      case 'continue':
        request =
            index.openCursor(IDBKeyRange.lowerBound(`k${primaryKey - 1}`));
        break;
      case 'continue-empty':
        // k4 is the last key in the data set, so calling continue() will get
        // the cursor past the end of the store.
        request = index.openCursor(IDBKeyRange.lowerBound('k4'));
        break;
      default:
        continue;
    }

    operation[2] = request;
    ++pendingCursors;

    request.onsuccess = testCase.step_func(() => {
      --pendingCursors;
      if (!pendingCursors)
        onsuccess();
    });
    request.onerror = testCase.step_func(onerror);
  }

  if (!pendingCursors)
    onsuccess();
}

function doOperation(testCase, store, index, operation, requestId, results) {
  const opcode = operation[0];
  const primaryKey = operation[1];
  const cursor = operation[2];

  return new Promise((resolve, reject) => {
    let request;
    switch (opcode) {
      case 'add':  // Tests returning a primary key.
        request =
            store.add({key: `k${primaryKey}`, value: [`small-${primaryKey}`]});
        break;
      case 'put':  // Tests returning a primary key.
        request =
            store.put({key: `k${primaryKey}`, value: [`small-${primaryKey}`]});
        break;
      case 'put-with-id':  // Tests returning success or a primary key.
        request = store.put({
          key: `k${primaryKey}`,
          value: [`small-${primaryKey}`],
          id: primaryKey
        });
        break;
      case 'get':        // Tests returning a value.
      case 'get-empty':  // Tests returning undefined.
        request = store.get(primaryKey);
        break;
      case 'getall':  // Tests returning an array of values.
        request = store.getAll();
        break;
      case 'error':  // Tests returning an error.
        request =
            store.put({key: `k${primaryKey}`, value: [`small-${primaryKey}`]});
        request.onerror = testCase.step_func(event => {
          event.preventDefault();
          results.push([requestId, request.error]);
          resolve();
        });
        request.onsuccess = testCase.step_func(() => {
          reject(new Error('put with duplicate primary key succeded'));
        });
        break;
      case 'continue':  // Tests returning a key, primary key, and value.
        request = cursor;
        cursor.result.continue();
        request.onsuccess = testCase.step_func(() => {
          const result = request.result;
          results.push(
              [requestId, result.key, result.primaryKey, result.value]);
          resolve();
        });
        request.onerror = null;
        break;
      case 'open':  // Tests returning a cursor, key, primary key, and value.
        request = index.openCursor(IDBKeyRange.lowerBound(`k${primaryKey}`));
        request.onsuccess = testCase.step_func(() => {
          const result = request.result;
          results.push(
              [requestId, result.key, result.primaryKey, result.value]);
          resolve();
        });
        break;
      case 'continue-empty':  // Tests returning a null result.
        request = cursor;
        cursor.result.continue();
        request.onsuccess = testCase.step_func(() => {
          results.push([requestId, request.result]);
          resolve();
        });
        request.onerror = null;
        break;
      case 'open-empty':  // Tests returning a null cursor.
        request = index.openCursor(IDBKeyRange.lowerBound(`k${primaryKey}`));
        request.onsuccess = testCase.step_func(() => {
          const result = request.result;
          results.push([requestId, request.result]);
          resolve();
        });
        break;
      case 'count':  // Tests returning a numeric result.
        request = index.count();
        request.onsuccess = testCase.step_func(() => {
          results.push([requestId, request.result]);
          resolve();
        });
        break;
    };

    if (!request.onsuccess) {
      request.onsuccess = testCase.step_func(() => {
        results.push([requestId, request.result]);
        resolve();
      });
    }
    if (!request.onerror)
      request.onerror = testCase.step_func(event => {
        event.preventDefault();
        reject(request.error);
      });
  });
}

function checkOperationResult(operation, result, requestId) {
  const opcode = operation[0];
  const primaryKey = operation[1];

  const expectedValue = (primaryKey == 1 || primaryKey == 3) ?
      largeValue(wrapThreshold, primaryKey) :
      [`small-${primaryKey}`];

  const requestIndex = result[0];
  assert_equals(
      requestIndex, requestId, 'result event order should match request order');
  switch (opcode) {
    case 'put':
    case 'put-with-id':
    case 'add':
      assert_equals(
          result[1], primaryKey,
          `${opcode} result should be the new object's primary key`);
      break;
    case 'get':
      assert_equals(
          result[1].id, primaryKey,
          'get result should match put value (primary key)');
      assert_equals(
          result[1].key, `k${primaryKey}`,
          'get result should match put value (key)');
      assert_equals(
          result[1].value.join(','), expectedValue.join(','),
          'get result should match put value (nested value)');
      break;
    case 'getall':
      assert_equals(
          result[1].length, primaryKey,
          'getAll should return all the objects in the store');
      for (let i = 0; i < primaryKey; ++i) {
        const object = result[1][i];
        assert_equals(
            object.id, i + 1,
            `getAll result ${i + 1} should match put value (primary key)`);
        assert_equals(
            object.key, `k${i + 1}`,
            `get result ${i + 1} should match put value (key)`);

        const expectedValue = (i == 0 || i == 2) ?
            largeValue(wrapThreshold, i + 1) :
            [`small-${i + 1}`];
        assert_equals(
            object.value.join(','), object.value.join(','),
            `get result ${i + 1} should match put value (nested value)`);
      }
      break;
    case 'get-empty':
      assert_equals(
          result[1], undefined, 'get-empty result should be undefined');
      break;
    case 'error':
      assert_equals(
          result[1].name, 'ConstraintError',
          'incorrect error from put with duplicate primary key');
      break;
    case 'continue':
    case 'open':
      assert_equals(
          result[1], `k${primaryKey}`,
          `${opcode} key should match the key in the put value`);
      assert_equals(
          result[2], primaryKey,
          `${opcode} primary key should match the put value's primary key`);
      assert_equals(
          result[3].id, primaryKey,
          `${opcode} value should match put value (primary key)`);
      assert_equals(
          result[3].key, `k${primaryKey}`,
          `${opcode} value should match put value (key)`);
      assert_equals(
          result[3].value.join(','), expectedValue.join(','),
          `${opcode} value should match put value (nested value)`);
      break;
    case 'continue-empty':
    case 'open-empty':
      assert_equals(result[1], null, `${opcode} result should be null`);
      break;
  }
}

function eventsTest(label, operations) {
  promise_test(testCase => {
    return createDatabase(
               testCase,
               (database, transaction) => {
                 const store = database.createObjectStore(
                     'test-store', {autoIncrement: true, keyPath: 'id'});
                 store.createIndex('test-index', 'key', {unique: true});
                 populateStore(store);
               })
        .then(database => {
          const transaction = database.transaction(['test-store'], 'readwrite');
          const store = transaction.objectStore('test-store');
          const index = store.index('test-index');
          return new Promise((resolve, reject) => {
            openCursors(testCase, index, operations, reject, () => {
              const results = [];
              const promises = [];
              for (let i = 0; i < operations.length; ++i) {
                const promise = doOperation(
                    testCase, store, index, operations[i], i, results);
                promises.push(promise);
              };
              resolve(Promise.all(promises).then(() => results));
            });
          });
        })
        .then(results => {
          assert_equals(
              results.length, operations.length,
              'Promise.all should resolve after all sub-promises resolve');
          for (let i = 0; i < operations.length; ++i)
            checkOperationResult(operations[i], results[i], i);
        });
  }, label);
}


// META: title=IndexedDB: request result events are delivered in order
// META: global=window,worker
// META: script=resources/support-promises.js
// META: script=resources/support.js
// META: script=resources/request-event-ordering-common.js
// META: timeout=long

// Spec: https://w3c.github.io/IndexedDB/#abort-transaction

'use strict';

eventsTest('large value followed by small values', [
  ['get', 1],
  ['getall', 4],
  ['open', 2],
  ['continue-empty', null],
  ['get', 2],
  ['get-empty', 5],
  ['count', 4],
  ['continue-empty', null],
  ['open-empty', 5],
  ['add', 5],
  ['error', 1],
  ['continue', 2],
  ['get-empty', 6],
  ['put-with-id', 5],
  ['put', 6],
]);
