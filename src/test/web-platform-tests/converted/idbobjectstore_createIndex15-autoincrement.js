import "../wpt-env.js";

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



  indexeddb_test(
    function(t, db, txn) {
      // No auto-increment
      var store = db.createObjectStore("Store1", {keyPath: "id"});
      store.createIndex("CompoundKey", ["num", "id"]);

      // Add data
      store.put({id: 1, num: 100});
    },
    function(t, db) {
      var store = db.transaction("Store1", "readwrite").objectStore("Store1");

      store.openCursor().onsuccess = t.step_func(function(e) {
        var item = e.target.result.value;
        store.index("CompoundKey").get([item.num, item.id]).onsuccess = t.step_func(function(e) {
          assert_equals(e.target.result ? e.target.result.num : null, 100, 'Expected 100.');
          t.done();
        });
      });
    },
    "Explicit Primary Key"
  );

  indexeddb_test(
    function(t, db, txn) {
      // Auto-increment
      var store = db.createObjectStore("Store2", {keyPath: "id", autoIncrement: true});
      store.createIndex("CompoundKey", ["num", "id"]);

      // Add data
      store.put({num: 100});
    },
    function(t, db) {
      var store = db.transaction("Store2", "readwrite").objectStore("Store2");
      store.openCursor().onsuccess = t.step_func(function(e) {
        var item = e.target.result.value;
        store.index("CompoundKey").get([item.num, item.id]).onsuccess = t.step_func(function(e) {
          assert_equals(e.target.result ? e.target.result.num : null, 100, 'Expected 100.');
          t.done();
        });
      });
    },
    "Auto-Increment Primary Key"
  );

  indexeddb_test(
    function(t, db, txn) {
      // Auto-increment
      var store = db.createObjectStore("Store3", {keyPath: "id", autoIncrement: true});
      store.createIndex("CompoundKey", ["num", "id", "other"]);

      var num = 100;

      // Add data to Store3 - valid keys
      // Objects will be stored in Store3 and keys will get added
      // to the CompoundKeys index.
      store.put({num: num++, other: 0});
      store.put({num: num++, other: [0]});

      // Add data - missing key
      // Objects will be stored in Store3 but keys won't get added to
      // the CompoundKeys index because the 'other' keypath doesn't
      // resolve to a value.
      store.put({num: num++});

      // Add data to Store3 - invalid keys
      // Objects will be stored in Store3 but keys won't get added to
      // the CompoundKeys index because the 'other' property values
      // aren't valid keys.
      store.put({num: num++, other: null});
      store.put({num: num++, other: {}});
      store.put({num: num++, other: [null]});
      store.put({num: num++, other: [{}]});
    },
    function(t, db) {
      var store = db.transaction("Store3", "readwrite").objectStore("Store3");
      const keys = [];
      let count;
      store.count().onsuccess = t.step_func(e => { count = e.target.result; });
      store.index("CompoundKey").openCursor().onsuccess = t.step_func(function(e) {
        const cursor = e.target.result;
        if (cursor !== null) {
          keys.push(cursor.key);
          cursor.continue();
          return;
        }

        // Done iteration, check results.
        assert_equals(count, 7, 'Expected all 7 records to be stored.');
        assert_equals(keys.length, 2, 'Expected exactly two index entries.');
        assert_array_equals(keys[0], [100, 1, 0]);
        assert_object_equals(keys[1], [101, 2, [0]]);
        t.done();
      });
    },
    "Auto-Increment Primary Key - invalid key values elsewhere"
  );
