import "../wpt-env.js";

let cursor,db,store,value;

globalThis.title = "IDBObjectStore.add()";

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


// META: global=window,worker
// META: title=IDBObjectStore.add()
// META: script=resources/support.js
// @author Microsoft <https://www.microsoft.com>
// @author Intel <http://www.intel.com>

'use_strict';

async_test(t => {
    let db;
    const record = { key: 1, property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      db = e.target.result;
      const objStore = db.createObjectStore("store", { keyPath: "key" });

      objStore.add(record);
    };

    open_rq.onsuccess = function(e) {
      const rq = db.transaction("store", "readonly")
        .objectStore("store")
        .get(record.key);

      rq.onsuccess = t.step_func(function(e) {
        assert_equals(e.target.result.property, record.property);
        assert_equals(e.target.result.key, record.key);
        t.done();
      });
    };
}, 'add() with an inline key');

async_test(t => {
    let db;
    const key = 1;
    const record = { property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      db = e.target.result;
      const objStore = db.createObjectStore("store");

      objStore.add(record, key);
    };

    open_rq.onsuccess = function(e) {
      const rq = db.transaction("store", "readonly")
        .objectStore("store")
        .get(key);

      rq.onsuccess = t.step_func(function(e) {
        assert_equals(e.target.result.property, record.property);

        t.done();
      });
    };
}, 'add() with an out-of-line key');

async_test(t => {
    const record = { key: 1, property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;
      const objStore = db.createObjectStore("store", { keyPath: "key" });
      objStore.add(record);

      const rq = objStore.add(record);
      rq.onsuccess = fail(t, "success on adding duplicate record");

      rq.onerror = t.step_func(function(e) {
        assert_equals(e.target.error.name, "ConstraintError");
        assert_equals(rq.error.name, "ConstraintError");
        assert_equals(e.type, "error");

        e.preventDefault();
        e.stopPropagation();
      });
    };

    // Defer done, giving rq.onsuccess a chance to run
    open_rq.onsuccess = function(e) {
      t.done();
    };
}, 'add() record with same key already exists');

async_test(t => {
    const record = { key: 1, property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;
      const objStore = db.createObjectStore("store", { autoIncrement: true });
      objStore.createIndex("i1", "property", { unique: true });
      objStore.add(record);

      const rq = objStore.add(record);
      rq.onsuccess = fail(t, "success on adding duplicate indexed record");

      rq.onerror = t.step_func(function(e) {
        assert_equals(rq.error.name, "ConstraintError");
        assert_equals(e.target.error.name, "ConstraintError");
        assert_equals(e.type, "error");

        e.preventDefault();
        e.stopPropagation();
      });
    };

    // Defer done, giving a spurious rq.onsuccess a chance to run
    open_rq.onsuccess = function(e) {
      t.done();
    };
}, 'add() where an index has unique:true specified');

async_test(t => {
    let db;
    const record = { test: { obj: { key: 1 } }, property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      db = e.target.result;
      const objStore = db.createObjectStore("store",
        { keyPath: "test.obj.key" });
      objStore.add(record);
    };

    open_rq.onsuccess = function(e) {
      const rq = db.transaction("store", "readonly")
        .objectStore("store")
        .get(record.test.obj.key);

      rq.onsuccess = t.step_func(function(e) {
        assert_equals(e.target.result.property, record.property);

        t.done();
      });
    };
}, 'add() object store\'s key path is an object attribute');

async_test(t => {
    let db;
    const record = { property: "data" };
    const expected_keys = [1, 2, 3, 4];

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      db = e.target.result;
      const objStore = db.createObjectStore("store", { keyPath: "key",
       autoIncrement: true });

      objStore.add(record);
      objStore.add(record);
      objStore.add(record);
      objStore.add(record);
    };

    open_rq.onsuccess = function(e) {
      const actual_keys = [];
      const rq = db.transaction("store", "readonly")
        .objectStore("store")
        .openCursor();

      rq.onsuccess = t.step_func(function(e) {
        const cursor = e.target.result;

        if (cursor) {
          actual_keys.push(cursor.value.key);
          cursor.continue();
        } else {
          assert_array_equals(actual_keys, expected_keys);
          t.done();
        }
      });
    };
}, 'add() autoIncrement and inline keys');

async_test(t => {
    let db;
    const record = { property: "data" };
    const expected_keys = [1, 2, 3, 4];

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      db = e.target.result;
      const objStore = db.createObjectStore("store", { autoIncrement: true });

      objStore.add(record);
      objStore.add(record);
      objStore.add(record);
      objStore.add(record);
    };

    open_rq.onsuccess = function(e) {
      const actual_keys = [];
      const rq = db.transaction("store", "readonly")
        .objectStore("store")
        .openCursor();

      rq.onsuccess = t.step_func(function(e) {
        const cursor = e.target.result;

        if (cursor) {
          actual_keys.push(cursor.key);
          cursor.continue();
        } else {
          assert_array_equals(actual_keys, expected_keys);
          t.done();
        }
      });
    };
}, 'add() autoIncrement and out-of-line keys');

async_test(t => {
    let db;
    const record = { property: "data" };
    const expected_keys = [1, 2, 3, 4];

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      db = e.target.result;
      const objStore = db.createObjectStore("store", { keyPath: "test.obj.key",
        autoIncrement: true });

      objStore.add(record);
      objStore.add(record);
      objStore.add(record);
      objStore.add(record);
    };

    open_rq.onsuccess = function(e) {
      const actual_keys = [];
      const rq = db.transaction("store", "readonly")
        .objectStore("store")
        .openCursor();

      rq.onsuccess = t.step_func(function(e) {
        const cursor = e.target.result;

        if (cursor) {
          actual_keys.push(cursor.value.test.obj.key);
          cursor.continue();
        } else {
          assert_array_equals(actual_keys, expected_keys);
          t.done();
        }
      });
    };
}, 'Object store has autoIncrement:true and the key path is an object \
attribute');

async_test(t => {
    const record = { key: 1, property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let rq;
      db = e.target.result;
      const objStore = db.createObjectStore("store", { keyPath: "key" });

      assert_throws_dom("DataError", function() {
        rq = objStore.add(record, 1);
      });

      assert_equals(rq, undefined);
      t.done();
    };
  }, 'Attempt to \'add()\' a record that does not meet the constraints of an \
  object store\'s inline key requirements');

async_test(t => {
    const record = { property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;
      let rq;
      const objStore = db.createObjectStore("store");

      assert_throws_dom("DataError", function() {
        rq = objStore.add(record);
      });

      assert_equals(rq, undefined);
      t.done();
    };
}, 'Attempt to call \'add()\' without a key parameter when the object store \
uses out-of-line keys');

async_test(t => {
    const record = { key: { value: 1 }, property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;

      let rq;
      const objStore = db.createObjectStore("store", { keyPath: "key" });

      assert_throws_dom("DataError", function() {
        rq = objStore.add(record);
      });

      assert_equals(rq, undefined);
      t.done();
    };
}, 'Attempt to \'add()\' a record where the record\'s key does not meet the \
constraints of a valid key');

async_test(t => {
    const record = { property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;

      let rq;
      const objStore = db.createObjectStore("store", { keyPath: "key" });

      assert_throws_dom("DataError", function() {
        rq = objStore.add(record);
      });

      assert_equals(rq, undefined);
      t.done();
    };
}, 'Attempt to \'add()\' a record where the record\'s in-line key is not \
 defined');

async_test(t => {
    const record = { property: "data" };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;

      let rq;
      const objStore = db.createObjectStore("store");

      assert_throws_dom("DataError", function() {
        rq = objStore.add(record, { value: 1 });
      });

      assert_equals(rq, undefined);
      t.done();
    };
}, 'Attempt to \'add()\' a record where the out of line key provided does not \
meet the constraints of a valid key');

async_test(t => {
    const record = { key: 1, indexedProperty: { property: "data" } };

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
      let db = e.target.result;

      let rq;
      const objStore = db.createObjectStore("store", { keyPath: "key" });

      objStore.createIndex("index", "indexedProperty");

      rq = objStore.add(record);

      assert_true(rq instanceof IDBRequest);
      rq.onsuccess = function() {
          t.done();
      }
    };
}, 'add() a record where a value being indexed does not meet the constraints \
of a valid key');

async_test(t => {
    let db;

    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function (event) {
        db = event.target.result;
        db.createObjectStore("store", {keyPath: "pKey"});
    }

    open_rq.onsuccess = function (event) {
        const txn = db.transaction("store", "readonly");
        const ostore = txn.objectStore("store");
        t.step(function() {
            assert_throws_dom("ReadOnlyError", function() {
                ostore.add({pKey: "primaryKey_0"});
            });
        });
        t.done();
    }
}, 'If the transaction this IDBObjectStore belongs to has its mode set to \
readonly, throw ReadOnlyError');

async_test(t => {
    const open_rq = createdb(t);
    open_rq.onupgradeneeded = function (event) {
        let db = event.target.result;
        const ostore = db.createObjectStore("store", {keyPath: "pKey"});
        db.deleteObjectStore("store");
        assert_throws_dom("InvalidStateError", function() {
            ostore.add({pKey: "primaryKey_0"});
        });
        t.done();
    };
}, 'If the object store has been deleted, the implementation must throw a \
DOMException of type InvalidStateError');
