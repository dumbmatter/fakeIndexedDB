import "../wpt-env.js";

let attrs,cursor,db,store,store2;

'use strict';

// Should be large enough to trigger large value handling in the IndexedDB
// engines that have special code paths for large values.
const wrapThreshold = 128 * 1024;

// Returns an IndexedDB value created from a descriptor.
//
// See the bottom of the file for descriptor samples.
function createValue(descriptor) {
  if (typeof(descriptor) != 'object')
    return descriptor;

  if (Array.isArray(descriptor))
    return descriptor.map((element) => createValue(element));

  if (!descriptor.hasOwnProperty('type')) {
    const value = {};
    for (let property of Object.getOwnPropertyNames(descriptor))
      value[property] = createValue(descriptor[property]);
    return value;
  }

  switch (descriptor.type) {
    case 'blob':
      return new Blob(
          [largeValue(descriptor.size, descriptor.seed)],
          { type: descriptor.mimeType });
    case 'buffer':
      return largeValue(descriptor.size, descriptor.seed);
  }
}

// Checks an IndexedDB value against a descriptor.
//
// Returns a Promise that resolves if the value passes the check.
//
// See the bottom of the file for descriptor samples.
function checkValue(testCase, value, descriptor) {
  if (typeof(descriptor) != 'object') {
    assert_equals(
        descriptor, value,
        'IndexedDB result should match put() argument');
    return Promise.resolve();
  }

  if (Array.isArray(descriptor)) {
    assert_true(
        Array.isArray(value),
        'IndexedDB result type should match put() argument');
    assert_equals(
        descriptor.length, value.length,
        'IndexedDB result array size should match put() argument');

    const subChecks = [];
    for (let i = 0; i < descriptor.length; ++i)
      subChecks.push(checkValue(testCase, value[i], descriptor[i]));
    return Promise.all(subChecks);
  }

  if (!descriptor.hasOwnProperty('type')) {
    assert_array_equals(
        Object.getOwnPropertyNames(value).sort(),
        Object.getOwnPropertyNames(descriptor).sort(),
        'IndexedDB result object properties should match put() argument');
    const subChecks = [];
    return Promise.all(Object.getOwnPropertyNames(descriptor).map(property =>
        checkValue(testCase, value[property], descriptor[property])));
  }

  switch (descriptor.type) {
    case 'blob':
      assert_class_string(
          value, 'Blob',
          'IndexedDB result class should match put() argument');
      assert_equals(
          descriptor.mimeType, value.type,
          'IndexedDB result Blob MIME type should match put() argument');
      assert_equals(descriptor.size, value.size, 'incorrect Blob size');
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = testCase.step_func(() => {
          if (reader.error) {
            reject(reader.error);
            return;
          }
          const view = new Uint8Array(reader.result);
          assert_equals(
              view.join(','),
              largeValue(descriptor.size, descriptor.seed).join(','),
              'IndexedDB result Blob content should match put() argument');
          resolve();
        });
        reader.readAsArrayBuffer(value);
      });

    case 'buffer':
      assert_class_string(
          value, 'Uint8Array',
          'IndexedDB result type should match put() argument');
      assert_equals(
          value.join(','),
          largeValue(descriptor.size, descriptor.seed).join(','),
          'IndexedDB result typed array content should match put() argument');
      return Promise.resolve();
  }
}

function cloningTestInternal(label, valueDescriptors, options) {
  promise_test(testCase => {
    return createDatabase(testCase, (database, transaction) => {
      testCase.add_cleanup(() => database.close());
      let store;
      if (options.useKeyGenerator) {
        store = database.createObjectStore(
            'test-store', { keyPath: 'primaryKey', autoIncrement: true });
      } else {
        store = database.createObjectStore('test-store');
      }
      for (let i = 0; i < valueDescriptors.length; ++i) {
        if (options.useKeyGenerator) {
          store.put(createValue(valueDescriptors[i]));
        } else {
          store.put(createValue(valueDescriptors[i]), i + 1);
        }
      }
    }).then(database => {
      const transaction = database.transaction(['test-store'], 'readonly');
      const store = transaction.objectStore('test-store');
      const subChecks = [];
      let resultIndex = 0;
      for (let i = 0; i < valueDescriptors.length; ++i) {
        subChecks.push(new Promise((resolve, reject) => {
          const requestIndex = i;
          const primaryKey = requestIndex + 1;
          const request = store.get(primaryKey);
          request.onerror =
              testCase.step_func(() => { reject(request.error); });
          request.onsuccess = testCase.step_func(() => {
            assert_equals(
                resultIndex, requestIndex,
                'IDBRequest success events should be fired in request order');
            ++resultIndex;

            const result = request.result;
            if (options.useKeyGenerator) {
              assert_equals(
                  result.primaryKey, primaryKey,
                  'IndexedDB result should have auto-incremented primary key');
              delete result.primaryKey;
            }
            resolve(checkValue(
                testCase, result, valueDescriptors[requestIndex]));
          });
        }));
      }

      subChecks.push(new Promise((resolve, reject) => {
        const requestIndex = valueDescriptors.length;
        const request = store.getAll();
        request.onerror =
            testCase.step_func(() => { reject(request.error); });
        request.onsuccess = testCase.step_func(() => {
          assert_equals(
              resultIndex, requestIndex,
              'IDBRequest success events should be fired in request order');
          ++resultIndex;
          const result = request.result;
          if (options.useKeyGenerator) {
            for (let i = 0; i < valueDescriptors.length; ++i) {
              const primaryKey = i + 1;
              assert_equals(
                  result[i].primaryKey, primaryKey,
                  'IndexedDB result should have auto-incremented primary key');
              delete result[i].primaryKey;
            }
          }
          resolve(checkValue(testCase, result, valueDescriptors));
        });
      }));

      return Promise.all(subChecks);
    });
  }, label);
}

// Performs a series of put()s and verifies that get()s and getAll() match.
//
// Each element of the valueDescriptors array is fed into createValue(), and the
// resulting value is written to IndexedDB via a put() request. After the writes
// complete, the values are read in the same order in which they were written.
// Last, all the results are read one more time via a getAll().
//
// The test verifies that the get() / getAll() results match the arguments to
// put() and that the order in which the get() result events are fired matches
// the order of the get() requests.
function cloningTest(label, valueDescriptors) {
  cloningTestInternal(label, valueDescriptors, { useKeyGenerator: false });
}

// cloningTest, with coverage for key generators.
//
// This creates two tests. One test performs a series of put()s and verifies
// that get()s and getAll() match, exactly like cloningTestWithoutKeyGenerator.
// The other test performs the same put()s in an object store with a key
// generator, and checks that the key generator works properly.
function cloningTestWithKeyGenerator(label, valueDescriptors) {
  cloningTestInternal(label, valueDescriptors, { useKeyGenerator: false });
  cloningTestInternal(
      label + " with key generator", valueDescriptors,
      { useKeyGenerator: true });
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


// META: script=nested-cloning-common.js
// META: script=support.js
// META: script=support-promises.js

'use strict';

// Define constants used to populate object stores and indexes.
const alphabet = 'abcdefghijklmnopqrstuvwxyz'.split('');
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const vowels = 'aeiou'.split('');

// Setup the object store identified by `storeName` to test `getAllKeys()`,
// `getAll()` and `getAllRecords()`.
//  - `callback` is a function that runs after setup with the arguments: `test`,
//    `connection`, and `expectedRecords`.
//  - The `expectedRecords` callback argument records all of the keys and values
//    added to the object store during setup.  It is an array of records where
//    each element contains a `key`, `primaryKey` and `value`.  Tests can use
//    `expectedRecords` to verify the actual results from a get all request.
function object_store_get_all_test_setup(storeName, callback, testDescription) {
  const expectedRecords = [];

  indexeddb_test(
      (test, connection) => {
        switch (storeName) {
          case 'generated': {
            // Create an object store with auto-generated, auto-incrementing,
            // inline keys.
            const store = connection.createObjectStore(
                storeName, {autoIncrement: true, keyPath: 'id'});
            alphabet.forEach(letter => {
              store.put({ch: letter});

              const generatedKey = alphabet.indexOf(letter) + 1;
              expectedRecords.push({
                key: generatedKey,
                primaryKey: generatedKey,
                value: {ch: letter}
              });
            });
            return;
          }
          case 'out-of-line': {
            // Create an object store with out-of-line keys.
            const store = connection.createObjectStore(storeName);
            alphabet.forEach(letter => {
              store.put(`value-${letter}`, letter);

              expectedRecords.push(
                  {key: letter, primaryKey: letter, value: `value-${letter}`});
            });
            return;
          }
          case 'empty': {
            // Create an empty object store.
            connection.createObjectStore(storeName);
            return;
          }
          case 'large-values': {
            // Create an object store with 3 large values. `largeValue()`
            // generates the value using the key as the seed.  The keys start at
            // 0 and then increment by 1.
            const store = connection.createObjectStore(storeName);
            for (let i = 0; i < 3; i++) {
              const value = largeValue(/*size=*/ wrapThreshold, /*seed=*/ i);
              store.put(value, i);

              expectedRecords.push({key: i, primaryKey: i, value});
            }
            return;
          }
        }
      },
      // Bind `expectedRecords` to the `indexeddb_test` callback function.
      (test, connection) => {
        callback(test, connection, expectedRecords);
      },
      testDescription);
}

// Similar to `object_store_get_all_test_setup()` above, but also creates an
// index named `test_idx` for each object store.
function index_get_all_test_setup(storeName, callback, testDescription) {
  const expectedRecords = [];

  indexeddb_test(
      function(test, connection) {
        switch (storeName) {
          case 'generated': {
            // Create an object store with auto-incrementing, inline keys.
            // Create an index on the uppercase letter property `upper`.
            const store = connection.createObjectStore(
                storeName, {autoIncrement: true, keyPath: 'id'});
            store.createIndex('test_idx', 'upper');
            alphabet.forEach(function(letter) {
              const value = {ch: letter, upper: letter.toUpperCase()};
              store.put(value);

              const generatedKey = alphabet.indexOf(letter) + 1;
              expectedRecords.push(
                  {key: value.upper, primaryKey: generatedKey, value});
            });
            return;
          }
          case 'out-of-line': {
            // Create an object store with out-of-line keys.  Create an index on
            // the uppercase letter property `upper`.
            const store = connection.createObjectStore(storeName);
            store.createIndex('test_idx', 'upper');
            alphabet.forEach(function(letter) {
              const value = {ch: letter, upper: letter.toUpperCase()};
              store.put(value, letter);

              expectedRecords.push(
                  {key: value.upper, primaryKey: letter, value});
            });
            return;
          }
          case 'out-of-line-not-unique': {
            // Create an index on the `half` property, which is not unique, with
            // two possible values: `first` and `second`.
            const store = connection.createObjectStore(storeName);
            store.createIndex('test_idx', 'half');
            alphabet.forEach(function(letter) {
              let half = 'first';
              if (letter > 'm') {
                half = 'second';
              }

              const value = {ch: letter, half};
              store.put(value, letter);

              expectedRecords.push({key: half, primaryKey: letter, value});
            });
            return
          }
          case 'out-of-line-multi': {
            // Create a multi-entry index on `attribs`, which is an array of
            // strings.
            const store = connection.createObjectStore(storeName);
            store.createIndex('test_idx', 'attribs', {multiEntry: true});
            alphabet.forEach(function(letter) {
              let attrs = [];
              if (['a', 'e', 'i', 'o', 'u'].indexOf(letter) != -1) {
                attrs.push('vowel');
              } else {
                attrs.push('consonant');
              }
              if (letter == 'a') {
                attrs.push('first');
              }
              if (letter == 'z') {
                attrs.push('last');
              }
              const value = {ch: letter, attribs: attrs};
              store.put(value, letter);

              for (let attr of attrs) {
                expectedRecords.push({key: attr, primaryKey: letter, value});
              }
            });
            return;
          }
          case 'empty': {
            // Create an empty index.
            const store = connection.createObjectStore(storeName);
            store.createIndex('test_idx', 'upper');
            return;
          }
          case 'large-values': {
            // Create an object store and index with 3 large values and their
            // seed.  Use the large value's seed as the index key.
            const store = connection.createObjectStore('large-values');
            store.createIndex('test_idx', 'seed');
            for (let i = 0; i < 3; i++) {
              const seed = i;
              const randomValue = largeValue(/*size=*/ wrapThreshold, seed);
              const recordValue = {seed, randomValue};
              store.put(recordValue, i);

              expectedRecords.push(
                  {key: seed, primaryKey: i, value: recordValue});
            }
            return;
          }
          default: {
            test.assert_unreached(`Unknown storeName: ${storeName}`);
          }
        }
      },
      // Bind `expectedRecords` to the `indexeddb_test` callback function.
      (test, connection) => {
        callback(test, connection, expectedRecords);
      },
      testDescription);
}

// Test `getAll()`, `getAllKeys()` or `getAllRecords()` on either `storeName` or
// `optionalIndexName` with the given `options`.
//
//  - `getAllFunctionName` is name of the function to test, which must be
//     `getAll`, `getAllKeys` or `getAllRecords`.
//
//  - `options` is an `IDBGetAllOptions` dictionary that may contain a  `query`,
//    `direction` and `count`.
//
// - `shouldUseDictionaryArgument` is true when testing the get all function
//    overloads that takes an `IDBGetAllOptions` dictionary.  False tests the
//    overloads that take two optional arguments: `query` and `count`.
function get_all_test(
    getAllFunctionName, storeName, optionalIndexName, options,
    shouldUseDictionaryArgument, testDescription) {
  const testGetAllCallback = (test, connection, expectedRecords) => {
    // Create a transaction and a get all request.
    const transaction = connection.transaction(storeName, 'readonly');
    let queryTarget = transaction.objectStore(storeName);
    if (optionalIndexName) {
      queryTarget = queryTarget.index(optionalIndexName);
    }
    const request = createGetAllRequest(
        getAllFunctionName, queryTarget, options, shouldUseDictionaryArgument);
    request.onerror = test.unreached_func('The get all request must succeed');

    // Verify the results after the get all request completes.
    request.onsuccess = test.step_func(event => {
      const actualResults = event.target.result;
      const expectedResults = calculateExpectedGetAllResults(
          getAllFunctionName, expectedRecords, options);
      verifyGetAllResults(getAllFunctionName, actualResults, expectedResults);
      test.done();
    });
  };

  if (optionalIndexName) {
    index_get_all_test_setup(storeName, testGetAllCallback, testDescription);
  } else {
    object_store_get_all_test_setup(
        storeName, testGetAllCallback, testDescription);
  }
}

function object_store_get_all_keys_test(storeName, options, testDescription) {
  get_all_test(
      'getAllKeys', storeName, /*indexName=*/ undefined, options,
      /*shouldUseDictionaryArgument=*/ false, testDescription);
}

function object_store_get_all_values_test(storeName, options, testDescription) {
  get_all_test(
      'getAll', storeName, /*indexName=*/ undefined, options,
      /*shouldUseDictionaryArgument=*/ false, testDescription);
}

function object_store_get_all_values_with_options_test(
    storeName, options, testDescription) {
  get_all_test(
      'getAll', storeName, /*indexName=*/ undefined, options,
      /*shouldUseDictionaryArgument=*/ true, testDescription);
}

function object_store_get_all_keys_with_options_test(
    storeName, options, testDescription) {
  get_all_test(
      'getAllKeys', storeName, /*indexName=*/ undefined, options,
      /*shouldUseDictionaryArgument=*/ true, testDescription);
}

function object_store_get_all_records_test(
    storeName, options, testDescription) {
  get_all_test(
      'getAllRecords', storeName, /*indexName=*/ undefined, options,
      /*shouldUseDictionaryArgument=*/ true, testDescription);
}

function index_get_all_keys_test(storeName, options, testDescription) {
  get_all_test(
      'getAllKeys', storeName, 'test_idx', options,
      /*shouldUseDictionaryArgument=*/ false, testDescription);
}

function index_get_all_keys_with_options_test(
    storeName, options, testDescription) {
  get_all_test(
      'getAllKeys', storeName, 'test_idx', options,
      /*shouldUseDictionaryArgument=*/ true, testDescription);
}

function index_get_all_values_test(storeName, options, testDescription) {
  get_all_test(
      'getAll', storeName, 'test_idx', options,
      /*shouldUseDictionaryArgument=*/ false, testDescription);
}

function index_get_all_values_with_options_test(
    storeName, options, testDescription) {
  get_all_test(
      'getAll', storeName, 'test_idx', options,
      /*shouldUseDictionaryArgument=*/ true, testDescription);
}

function index_get_all_records_test(storeName, options, testDescription) {
  get_all_test(
      'getAllRecords', storeName, 'test_idx', options,
      /*shouldUseDictionaryArgument=*/ true, testDescription);
}

function createGetAllRequest(
    getAllFunctionName, queryTarget, options, shouldUseDictionaryArgument) {
  if (options && shouldUseDictionaryArgument) {
    assert_true(
        'getAllRecords' in queryTarget,
        `"${queryTarget}" must support "getAllRecords()" to use an "IDBGetAllOptions" dictionary with "${
            getAllFunctionName}".`);
    return queryTarget[getAllFunctionName](options);
  }
  // `getAll()` and `getAllKeys()` use optional arguments.  Omit the
  // optional arguments when undefined.
  if (options && options.count) {
    return queryTarget[getAllFunctionName](options.query, options.count);
  }
  if (options && options.query) {
    return queryTarget[getAllFunctionName](options.query);
  }
  return queryTarget[getAllFunctionName]();
}

// Returns the expected results when `getAllFunctionName` is called with
// `options` to query an object store or index containing `records`.
function calculateExpectedGetAllResults(getAllFunctionName, records, options) {
  const expectedRecords = filterWithGetAllRecordsOptions(records, options);
  switch (getAllFunctionName) {
    case 'getAll':
      return expectedRecords.map(({value}) => {return value});
    case 'getAllKeys':
      return expectedRecords.map(({primaryKey}) => {return primaryKey});
    case 'getAllRecords':
      return expectedRecords;
  }
  assert_unreached(`Unknown getAllFunctionName: "${getAllFunctionName}"`);
}

// Asserts that the array of results from `getAllFunctionName` matches the
// expected results.
function verifyGetAllResults(getAllFunctionName, actual, expected) {
  switch (getAllFunctionName) {
    case 'getAll':
      assert_idb_values_equals(actual, expected);
      return;
    case 'getAllKeys':
      assert_array_equals(actual, expected);
      return;
    case 'getAllRecords':
      assert_records_equals(actual, expected);
      return;
  }
  assert_unreached(`Unknown getAllFunctionName: "${getAllFunctionName}"`);
}

// Returns the array of `records` that satisfy `options`.  Tests may use this to
// generate expected results.
//  - `records` is an array of objects where each object has the properties:
//    `key`, `primaryKey`, and `value`.
//  - `options` is an `IDBGetAllRecordsOptions ` dictionary that may contain a
//    `query`, `direction` and `count`.
function filterWithGetAllRecordsOptions(records, options) {
  if (!options) {
    return records;
  }

  // Remove records that don't satisfy the query.
  if (options.query) {
    let query = options.query;
    if (!(query instanceof IDBKeyRange)) {
      // Create an IDBKeyRange for the query's key value.
      query = IDBKeyRange.only(query);
    }
    records = records.filter(record => query.includes(record.key));
  }

  // Remove duplicate records.
  if (options.direction === 'nextunique' ||
      options.direction === 'prevunique') {
    const uniqueRecords = [];
    records.forEach(record => {
      if (!uniqueRecords.some(
              unique => IDBKeyRange.only(unique.key).includes(record.key))) {
        uniqueRecords.push(record);
      }
    });
    records = uniqueRecords;
  }

  // Reverse the order of the records.
  if (options.direction === 'prev' || options.direction === 'prevunique') {
    records = records.slice().reverse();
  }

  // Limit the number of records.
  if (options.count) {
    records = records.slice(0, options.count);
  }
  return records;
}

function isArrayOrArrayBufferView(value) {
  return Array.isArray(value) || ArrayBuffer.isView(value);
}

// This function compares the string representation of the arrays because
// `assert_array_equals()` is too slow for large values.
function assert_large_array_equals(actual, expected, description) {
  const array_string = actual.join(',');
  const expected_string = expected.join(',');
  assert_equals(array_string, expected_string, description);
}

// Verifies two IDB values are equal.  The expected value may be a primitive, an
// object, or an array.
function assert_idb_value_equals(actual_value, expected_value) {
  if (isArrayOrArrayBufferView(expected_value)) {
    assert_large_array_equals(
        actual_value, expected_value,
        'The record must have the expected value');
  } else if (typeof expected_value === 'object') {
    // Verify each property of the object value.
    for (let property_name of Object.keys(expected_value)) {
      if (isArrayOrArrayBufferView(expected_value[property_name])) {
        // Verify the array property value.
        assert_large_array_equals(
            actual_value[property_name], expected_value[property_name],
            `The record must contain the array value "${
                JSON.stringify(
                    expected_value)}" with property "${property_name}"`);
      } else {
        // Verify the primitive property value.
        assert_equals(
            actual_value[property_name], expected_value[property_name],
            `The record must contain the value "${
                JSON.stringify(
                    expected_value)}" with property "${property_name}"`);
      }
    }
  } else {
    // Verify the primitive value.
    assert_equals(
        actual_value, expected_value,
        'The record must have the expected value');
  }
}

// Verifies each record from the results of `getAllRecords()`.
function assert_record_equals(actual_record, expected_record) {
  assert_class_string(
      actual_record, "FDBRecord", 'The record must be an IDBRecord');
  assert_idl_attribute(
      actual_record, 'key', 'The record must have a key attribute');
  assert_idl_attribute(
      actual_record, 'primaryKey',
      'The record must have a primaryKey attribute');
  assert_idl_attribute(
      actual_record, 'value', 'The record must have a value attribute');

  // Verify the attributes: `key`, `primaryKey` and `value`.
  assert_equals(
      actual_record.primaryKey, expected_record.primaryKey,
      'The record must have the expected primaryKey');
  assert_equals(
      actual_record.key, expected_record.key,
      'The record must have the expected key');
  assert_idb_value_equals(actual_record.value, expected_record.value);
}

// Verifies the results from `getAllRecords()`, which is an array of records:
// [
//   { 'key': key1, 'primaryKey': primary_key1, 'value': value1 },
//   { 'key': key2, 'primaryKey': primary_key2, 'value': value2 },
//   ...
// ]
function assert_records_equals(actual_records, expected_records) {
  assert_true(
      Array.isArray(actual_records),
      'The records must be an array of IDBRecords');
  assert_equals(
      actual_records.length, expected_records.length,
      'The records array must contain the expected number of records');

  for (let i = 0; i < actual_records.length; i++) {
    assert_record_equals(actual_records[i], expected_records[i]);
  }
}

// Verifies the results from `getAll()`, which is an array of IndexedDB record
// values.
function assert_idb_values_equals(actual_values, expected_values) {
  assert_true(Array.isArray(actual_values), 'The values must be an array');
  assert_equals(
      actual_values.length, expected_values.length,
      'The values array must contain the expected number of values');

  for (let i = 0; i < actual_values.length; i++) {
    assert_idb_value_equals(actual_values[i], expected_values[i]);
  }
}

// Test passing both an options dictionary  and a count to `getAll()` and
// `getAllKeys()`.  The get all request must ignore the `count` argument, using
//  count from the options dictionary instead.
function get_all_with_options_and_count_test(
    getAllFunctionName, storeName, optionalIndexName, testDescription) {
  // Set up the object store or index to query.
  const setupFunction = optionalIndexName ? index_get_all_test_setup :
                                            object_store_get_all_test_setup;

  setupFunction(storeName, (test, connection, expectedRecords) => {
    const transaction = connection.transaction(storeName, 'readonly');
    let queryTarget = transaction.objectStore(storeName);
    if (optionalIndexName) {
      queryTarget = queryTarget.index(optionalIndexName);
    }

    const options = {count: 10};
    const request = queryTarget[getAllFunctionName](options, /*count=*/ 17);

    request.onerror =
        test.unreached_func(`"${getAllFunctionName}()" request must succeed.`);

    request.onsuccess = test.step_func(event => {
      const expectedResults = calculateExpectedGetAllResults(
          getAllFunctionName, expectedRecords, options);

      const actualResults = event.target.result;
      verifyGetAllResults(getAllFunctionName, actualResults, expectedResults);

      test.done();
    });
  }, testDescription);
}

// Get all operations must throw a `DataError` exception for invalid query keys.
// See `get_all_test()` above for a description of the parameters.
function get_all_with_invalid_keys_test(
    getAllFunctionName, storeName, optionalIndexName,
    shouldUseDictionaryArgument, testDescription) {
  // Set up the object store or index to query.
  const setupFunction = optionalIndexName ? index_get_all_test_setup :
                                            object_store_get_all_test_setup;

  setupFunction(storeName, (test, connection, expectedRecords) => {
    const transaction = connection.transaction(storeName, 'readonly');
    let queryTarget = transaction.objectStore(storeName);
    if (optionalIndexName) {
      queryTarget = queryTarget.index(optionalIndexName);
    }

    const invalidKeys = [
      {
        description: 'Date(NaN)',
        value: new Date(NaN),
      },
      {
        description: 'Array',
        value: [{}],
      },
      {
        description: 'detached TypedArray',
        value: createDetachedArrayBuffer(),
      },
      {
        description: 'detached ArrayBuffer',
        value: createDetachedArrayBuffer().buffer
      },
    ];
    invalidKeys.forEach(({description, value}) => {
      const argument = shouldUseDictionaryArgument ? {query: value} : value;
      assert_throws_dom('DataError', () => {
        queryTarget[getAllFunctionName](argument);
      }, `An invalid ${description} key must throw an exception.`);
    });
    test.done();
  }, testDescription);
}


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


// META: title=IndexedDB: Test IDBIndex.getAll
// META: global=window,worker
// META: script=resources/nested-cloning-common.js
// META: script=resources/support.js
// META: script=resources/support-get-all.js
// META: script=resources/support-promises.js
// META: timeout=long

'use_strict';

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {query: 'C'}, 'Single item get');

index_get_all_values_test(
    /*storeName=*/ 'empty', /*options=*/ undefined, 'Empty object store');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ undefined, 'Get all');

index_get_all_values_test(
    /*storeName=*/ 'generated', /*options=*/ undefined,
    'Get all with generated keys');

index_get_all_values_test(
    /*storeName=*/ 'large-values', /*options=*/ undefined,
    'Get all with large values');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {count: 10}, 'maxCount=10');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line',
    /*options=*/ {query: IDBKeyRange.bound('G', 'M')}, 'Get bound range');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line',
    /*options=*/ {query: IDBKeyRange.bound('G', 'M'), count: 3},
    'Get bound range with maxCount');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {
      query:
          IDBKeyRange.bound('G', 'K', /*lowerOpen=*/ false, /*upperOpen=*/ true)
    },
    'Get upper excluded');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {
      query:
          IDBKeyRange.bound('G', 'K', /*lowerOpen=*/ true, /*upperOpen=*/ false)
    },
    'Get lower excluded');

index_get_all_values_test(
    /*storeName=*/ 'generated',
    /*options=*/ {query: IDBKeyRange.bound(4, 15), count: 3},
    'Get bound range (generated) with maxCount');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {query: 'Doesn\'t exist'},
    'Non existent key');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {count: 0}, 'maxCount=0');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line', /*options=*/ {count: 4294967295},
    'Max value count');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line',
    /*options=*/ {query: IDBKeyRange.upperBound('0')},
    'Query with empty range where  first key < upperBound');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line',
    /*options=*/ {query: IDBKeyRange.lowerBound('ZZ')},
    'Query with empty range where lowerBound < last key');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line-not-unique', /*options=*/ {query: 'first'},
    'Retrieve multiEntry key');

index_get_all_values_test(
    /*storeName=*/ 'out-of-line-multi', /*options=*/ {query: 'vowel'},
    'Retrieve one key multiple values');

get_all_with_invalid_keys_test(
    'getAll', /*storeName=*/ 'out-of-line', /*indexName=*/ 'test_idx',
    /*shouldUseDictionary=*/ false, 'Get all values with invalid query keys');
