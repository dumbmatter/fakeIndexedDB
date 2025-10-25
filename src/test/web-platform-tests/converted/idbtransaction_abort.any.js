import "../wpt-env.js";

globalThis.title = "IDBTransaction - abort";

'use strict';
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


// META: title=IDBTransaction - abort
// META: global=window,worker
// META: script=resources/support.js

// Spec: https://w3c.github.io/IndexedDB/#transaction-abort

'use strict';

async_test(t => {
  let db;
  let aborted;
  const record = {indexedProperty: 'bar'};

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    let txn = e.target.transaction;
    let objStore = db.createObjectStore('store');
    objStore.add(record, 1);
    objStore.add(record, 2);
    let index =
        objStore.createIndex('index', 'indexedProperty', {unique: true});

    assert_true(index instanceof IDBIndex, 'IDBIndex');

    e.target.transaction.onabort = t.step_func(function(e) {
      aborted = true;
      assert_equals(e.type, 'abort', 'event type');
    });

    db.onabort = function(e) {
      assert_true(aborted, 'transaction.abort event has fired');
      t.done();
    };

    e.target.transaction.oncomplete = fail(t, 'got complete, expected abort');
  };
}, 'Abort event should fire during transaction');

indexeddb_test(
    (t, db) => {
      db.createObjectStore('blobs', {keyPath: 'id', autoIncrement: true});
    },
    (t, db) => {
      const txn = db.transaction('blobs', 'readwrite');
      const objectStore = txn.objectStore('blobs');
      const data = new Blob(['test'], {type: 'text/plain'});

      const putRequest = objectStore.put({id: 0, data: data});

      putRequest.onsuccess = t.step_func(() => {
        t.step_timeout(() => {
          assert_throws_dom('InvalidStateError', () => {
            txn.abort();
          }, 'Abort should throw InvalidStateError on an auto-committing transaction.');
        }, 0);
      });

      // Ensure the transaction completes.
      txn.oncomplete = t.step_func(() => {
        t.done();
      });

      // Abort should fail once the transaction has started committing.
      txn.onabort = t.step_func((event) => {
        assert_unreached('Unexpected transaction abort: ' + event.target.error);
      });
      t.add_cleanup(() => {
        if (db) {
          db.close();
        }
      });
    },
    `Abort during auto-committing should throw InvalidStateError.`);

indexeddb_test(
    (t, db) => {
      db.createObjectStore('blobs', {keyPath: 'id', autoIncrement: true});
    },
    (t, db) => {
      const txn = db.transaction('blobs', 'readwrite');
      const objectStore = txn.objectStore('blobs');
      const data = new Blob(['test'], {type: 'text/plain'});

      // Put the object into the store.
      const putRequest = objectStore.put({id: 0, data: data});

      // Handle transaction completion.
      txn.oncomplete = t.step_func(() => {
        assert_throws_dom('InvalidStateError', () => {
          txn.abort();
        }, 'Abort should throw InvalidStateError on a completed transaction.');
        t.done();
      });

      // Handle transaction error.
      txn.onerror = t.step_func((event) => {
        assert_unreached('Unexpected transaction error: ' + event.target.error);
      });

      t.add_cleanup(() => {
        if (db) {
          db.close();
        }
      });
    },
    `Abort on completed transaction should throw InvalidStateError.`);
