import "../wpt-env.js";

globalThis.title = "IDB-backed composite blobs maintain coherency";

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


// META: title=IDB-backed composite blobs maintain coherency
// META: script=resources/support-promises.js
// META: timeout=long
'use strict';

// This test file is intended to help validate browser handling of complex blob
// scenarios where one or more levels of multipart blobs are used and varying
// IPC serialization strategies may be used depending on various complexity
// heuristics.
//
// A variety of approaches of reading the blob's contents are attempted for
// completeness:
// - `fetch-blob-url`: fetch of a URL created via URL.createObjectURL
//   - Note that this is likely to involve multi-process behavior in a way that
//     the next 2 currently will not unless their Blobs are round-tripped
//     through a MessagePort.
// - `file-reader`: FileReader
// - `direct`: Blob.prototype.arrayBuffer()

function composite_blob_test({ blobCount, blobSize, name }) {
  // NOTE: In order to reduce the runtime of this test and due to the similarity
  // of the "file-reader" mechanism to the "direct", "file-reader" is commented
  // out, but if you are investigating failures detected by this test, you may
  // want to uncomment it.
  for (const mode of ["fetch-blob-url", /*"file-reader",*/ "direct"]) {
    promise_test(async testCase => {
      const key = "the-blobs";
      let memBlobs = [];
      for (let iBlob = 0; iBlob < blobCount; iBlob++) {
        memBlobs.push(new Blob([make_arraybuffer_contents(iBlob, blobSize)]));
      }

      const db = await createDatabase(testCase, db => {
        db.createObjectStore("blobs");
      });

      const write_tx = db.transaction("blobs", "readwrite");
      let store = write_tx.objectStore("blobs");
      store.put(memBlobs, key);
      // Make the blobs eligible for GC which is most realistic and most likely
      // to cause problems.
      memBlobs = null;

      await promiseForTransaction(testCase, write_tx);

      const read_tx = db.transaction("blobs", "readonly");
      store = read_tx.objectStore("blobs");
      const read_req = store.get(key);

      await promiseForTransaction(testCase, read_tx);

      const diskBlobs = read_req.result;
      const compositeBlob = new Blob(diskBlobs);

      if (mode === "fetch-blob-url") {
        const blobUrl = URL.createObjectURL(compositeBlob);
        let urlResp = await fetch(blobUrl);
        let urlFetchArrayBuffer = await urlResp.arrayBuffer();
        urlResp = null;

        URL.revokeObjectURL(blobUrl);
        validate_arraybuffer_contents("fetched URL", urlFetchArrayBuffer, blobCount, blobSize);
        urlFetchArrayBuffer = null;

      } else if (mode === "file-reader") {
        let reader = new FileReader();
        let readerPromise = new Promise(resolve => {
          reader.onload = () => {
            resolve(reader.result);
          }
        })
        reader.readAsArrayBuffer(compositeBlob);

        let readArrayBuffer = await readerPromise;
        readerPromise = null;
        reader = null;

        validate_arraybuffer_contents("FileReader", readArrayBuffer, blobCount, blobSize);
        readArrayBuffer = null;
      } else if (mode === "direct") {
        let directArrayBuffer = await compositeBlob.arrayBuffer();
        validate_arraybuffer_contents("arrayBuffer", directArrayBuffer, blobCount, blobSize);
      }
    }, `Composite Blob Handling: ${name}: ${mode}`);
  }
}

// Create an ArrayBuffer whose even bytes are the index identifier and whose
// odd bytes are a sequence incremented by 3 (wrapping at 256) so that
// discontinuities at power-of-2 boundaries are more detectable.
function make_arraybuffer_contents(index, size) {
  const arr = new Uint8Array(size);
  for (let i = 0, counter = 0; i < size; i += 2, counter = (counter + 3) % 256) {
    arr[i] = index;
    arr[i + 1] = counter;
  }
  return arr.buffer;
}

function validate_arraybuffer_contents(source, buffer, blobCount, blobSize) {
  // Accumulate a list of problems we perceive so we can report what seems to
  // have happened all at once.
  const problems = [];

  const arr = new Uint8Array(buffer);

  const expectedLength = blobCount * blobSize;
  const actualCount = arr.length / blobSize;
  if (arr.length !== expectedLength) {
    problems.push(`ArrayBuffer only holds ${actualCount} blobs' worth instead of ${blobCount}.`);
    problems.push(`Actual ArrayBuffer is ${arr.length} bytes but expected ${expectedLength}`);
  }

  const counterBlobStep = (blobSize / 2 * 3) % 256;
  let expectedBlob = 0;
  let blobSeenSoFar = 0;
  let expectedCounter = 0;
  let counterDrift = 0;
  for (let i = 0; i < arr.length; i += 2) {
    if (arr[i] !== expectedBlob || blobSeenSoFar >= blobSize) {
      if (blobSeenSoFar !== blobSize) {
        problems.push(`Truncated blob ${expectedBlob} after ${blobSeenSoFar} bytes.`);
      } else {
        expectedBlob++;
      }
      if (expectedBlob !== arr[i]) {
        problems.push(`Expected blob ${expectedBlob} but found ${arr[i]}, compensating.`);
        expectedBlob = arr[i];
      }
      blobSeenSoFar = 0;
      expectedCounter = (expectedBlob * counterBlobStep) % 256;
      counterDrift = 0;
    }

    if (arr[i + 1] !== (expectedCounter + counterDrift) % 256) {
      const newDrift = expectedCounter - arr[i + 1];
      problems.push(`In blob ${expectedBlob} at ${blobSeenSoFar + 1} bytes in, counter drift now ${newDrift} was ${counterDrift}`);
      counterDrift = newDrift;
    }

    blobSeenSoFar += 2;
    expectedCounter = (expectedCounter + 3) % 256;
  }

  if (problems.length) {
    assert_true(false, `${source} blob payload problem: ${problems.join("\n")}`);
  } else {
    assert_true(true, `${source} blob payloads validated.`);
  }
}

composite_blob_test({
  blobCount: 16,
  blobSize: 256 * 1024,
  name: "Many blobs",
});
