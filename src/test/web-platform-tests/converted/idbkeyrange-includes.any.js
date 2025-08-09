import "../wpt-env.js";

let attrs,cursor,db,store,store2;

globalThis.title = "IndexedDB: IDBKeyRange.includes()";

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


// META: title=IndexedDB: IDBKeyRange.includes()
// META: global=window,worker
// META: script=resources/support.js

// Spec: https://w3c.github.io/IndexedDB/#keyrange

'use strict';

test(() => {
  const range = IDBKeyRange.bound(12, 34);
  assert_throws_js(TypeError, () => {
    range.includes();
  }, 'throws if key is not specified');

  assert_throws_dom('DataError', () => {
    range.includes(undefined);
  }, 'throws if key is undefined');
  assert_throws_dom('DataError', () => {
    range.includes(null);
  }, 'throws if key is null');
  assert_throws_dom('DataError', () => {
    range.includes({});
  }, 'throws if key is not valid type');
  assert_throws_dom('DataError', () => {
    range.includes(NaN);
  }, 'throws if key is not valid number');
  assert_throws_dom('DataError', () => {
    range.includes(new Date(NaN));
  }, 'throws if key is not valid date');
  assert_throws_dom('DataError', () => {
    var a = [];
    a[0] = a;
    range.includes(a);
  }, 'throws if key is not valid array');
}, 'IDBKeyRange.includes() with invalid input');

test(() => {
  const closedRange = IDBKeyRange.bound(5, 20);
  assert_true(!!closedRange.includes, 'IDBKeyRange has a .includes');
  assert_true(closedRange.includes(7), 'in range');
  assert_false(closedRange.includes(1), 'below range');
  assert_false(closedRange.includes(42), 'above range');
  assert_true(closedRange.includes(5.01), 'at the lower end of the range');
  assert_true(closedRange.includes(19.99), 'at the upper end of the range');
  assert_false(closedRange.includes(4.99), 'right below range');
  assert_false(closedRange.includes(21.01), 'right above range');

  assert_true(closedRange.includes(5), 'lower boundary');
  assert_true(closedRange.includes(20), 'upper boundary');
}, 'IDBKeyRange.includes() with a closed range');

test(() => {
  const closedRange = IDBKeyRange.bound(5, 20, true, true);
  assert_true(closedRange.includes(7), 'in range');
  assert_false(closedRange.includes(1), 'below range');
  assert_false(closedRange.includes(42), 'above range');
  assert_true(closedRange.includes(5.01), 'at the lower end of the range');
  assert_true(closedRange.includes(19.99), 'at the upper end of the range');
  assert_false(closedRange.includes(4.99), 'right below range');
  assert_false(closedRange.includes(21.01), 'right above range');

  assert_false(closedRange.includes(5), 'lower boundary');
  assert_false(closedRange.includes(20), 'upper boundary');
}, 'IDBKeyRange.includes() with an open range');

test(() => {
  const range = IDBKeyRange.bound(5, 20, true);
  assert_true(range.includes(7), 'in range');
  assert_false(range.includes(1), 'below range');
  assert_false(range.includes(42), 'above range');
  assert_true(range.includes(5.01), 'at the lower end of the range');
  assert_true(range.includes(19.99), 'at the upper end of the range');
  assert_false(range.includes(4.99), 'right below range');
  assert_false(range.includes(21.01), 'right above range');

  assert_false(range.includes(5), 'lower boundary');
  assert_true(range.includes(20), 'upper boundary');
}, 'IDBKeyRange.includes() with a lower-open upper-closed range');

test(() => {
  const range = IDBKeyRange.bound(5, 20, false, true);
  assert_true(range.includes(7), 'in range');
  assert_false(range.includes(1), 'below range');
  assert_false(range.includes(42), 'above range');
  assert_true(range.includes(5.01), 'at the lower end of the range');
  assert_true(range.includes(19.99), 'at the upper end of the range');
  assert_false(range.includes(4.99), 'right below range');
  assert_false(range.includes(21.01), 'right above range');

  assert_true(range.includes(5), 'lower boundary');
  assert_false(range.includes(20), 'upper boundary');
}, 'IDBKeyRange.includes() with a lower-closed upper-open range');

test(() => {
  const onlyRange = IDBKeyRange.only(42);
  assert_true(onlyRange.includes(42), 'in range');
  assert_false(onlyRange.includes(1), 'below range');
  assert_false(onlyRange.includes(9000), 'above range');
  assert_false(onlyRange.includes(41), 'right below range');
  assert_false(onlyRange.includes(43), 'right above range');
}, 'IDBKeyRange.includes() with an only range');

test(() => {
  const range = IDBKeyRange.lowerBound(5);
  assert_false(range.includes(4), 'value before closed lower bound');
  assert_true(range.includes(5), 'value at closed lower bound');
  assert_true(range.includes(6), 'value after closed lower bound');
  assert_true(range.includes(42), 'value way after open lower bound');
}, 'IDBKeyRange.includes() with an closed lower-bounded range');

test(() => {
  const range = IDBKeyRange.lowerBound(5, true);
  assert_false(range.includes(4), 'value before open lower bound');
  assert_false(range.includes(5), 'value at open lower bound');
  assert_true(range.includes(6), 'value after open lower bound');
  assert_true(range.includes(42), 'value way after open lower bound');
}, 'IDBKeyRange.includes() with an open lower-bounded range');

test(() => {
  const range = IDBKeyRange.upperBound(5);
  assert_true(range.includes(-42), 'value way before closed upper bound');
  assert_true(range.includes(4), 'value before closed upper bound');
  assert_true(range.includes(5), 'value at closed upper bound');
  assert_false(range.includes(6), 'value after closed upper bound');
}, 'IDBKeyRange.includes() with an closed upper-bounded range');

test(() => {
  const range = IDBKeyRange.upperBound(5, true);
  assert_true(range.includes(-42), 'value way before closed upper bound');
  assert_true(range.includes(4), 'value before open upper bound');
  assert_false(range.includes(5), 'value at open upper bound');
  assert_false(range.includes(6), 'value after open upper bound');
}, 'IDBKeyRange.includes() with an open upper-bounded range');

test((t) => {
  assert_true(IDBKeyRange.bound(new Date(0), new Date())
                  .includes(new Date(102729600000)));
  assert_false(IDBKeyRange.bound(new Date(0), new Date(1e11))
                   .includes(new Date(1e11 + 1)));

  assert_true(IDBKeyRange.bound('a', 'c').includes('b'));
  assert_false(IDBKeyRange.bound('a', 'c').includes('d'));

  assert_true(IDBKeyRange.bound([], [[], []]).includes([[]]));
  assert_false(IDBKeyRange.bound([], [[]]).includes([[[]]]));
}, 'IDBKeyRange.includes() with non-numeric keys');
