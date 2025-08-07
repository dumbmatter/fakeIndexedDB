import "../wpt-env.js";

let attrs,cursor,db,store,store2;

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


// META: title=IDBFactory.open()
// META: global=window,worker
// META: script=resources/support.js
// @author Microsoft <https://www.microsoft.com>
// @author Odin H�rthe Omdal <mailto:odinho@opera.com>

'use strict';

async_test(t => {
    const open_rq = createdb(t, undefined, 9);

    open_rq.onupgradeneeded = function (e) { };
    open_rq.onsuccess = function (e) {
        assert_equals(e.target.source, null, "source")
        t.done();
    }
}, "IDBFactory.open() - request has no source");

async_test(t => {
    let database_name = location + '-database_name';
    const open_rq = createdb(t, database_name, 13);

    open_rq.onupgradeneeded = function (e) { };
    open_rq.onsuccess = function (e) {
        let db = e.target.result;
        assert_equals(db.name, database_name, 'db.name');
        assert_equals(db.version, 13, 'db.version');
        t.done();
    }
}, "IDBFactory.open() - database 'name' and 'version' are correctly set");

async_test(t => {
    const open_rq = createdb(t, undefined, 13);
    let did_upgrade = false;

    open_rq.onupgradeneeded = function () { };
    open_rq.onsuccess = function (e) {
        let db = e.target.result;
        db.close();

        let open_rq2 = indexedDB.open(db.name);
        open_rq2.onsuccess = t.step_func(function (e) {
            assert_equals(e.target.result.version, 13, "db.version")
            e.target.result.close();
            t.done();
        });
        open_rq2.onupgradeneeded = fail(t, 'Unexpected upgradeneeded')
        open_rq2.onerror = fail(t, 'Unexpected error')
    }
}, "IDBFactory.open() - no version opens current database");

async_test(t => {
    const open_rq = createdb(t, self.location + '-database_name_new');
    open_rq.onupgradeneeded = function (e) {
        assert_equals(e.target.result.version, 1, "db.version");
    };
    open_rq.onsuccess = function (e) {
        assert_equals(e.target.result.version, 1, "db.version");
        t.done();
    };
}, "IDBFactory.open() - new database has default version");

async_test(t => {
    const open_rq = createdb(t, self.location + '-database_name');

    open_rq.onupgradeneeded = function () { };
    open_rq.onsuccess = function (e) {
        assert_equals(e.target.result.objectStoreNames.length, 0, "objectStoreNames.length");
        t.done();
    };
}, "IDBFactory.open() - new database is empty");

async_test(t => {
    const open_rq = createdb(t, undefined, 13);
    let did_upgrade = false;
    let open_rq2;

    open_rq.onupgradeneeded = function () { };
    open_rq.onsuccess = function (e) {
        let db = e.target.result;
        db.close();

        open_rq2 = indexedDB.open(db.name, 14);
        open_rq2.onupgradeneeded = function () { };
        open_rq2.onsuccess = t.step_func(open_previous_db);
        open_rq2.onerror = fail(t, 'Unexpected error')
    }

    function open_previous_db(e) {
        let open_rq3 = indexedDB.open(e.target.result.name, 13);
        open_rq3.onerror = t.step_func(function (e) {
            assert_equals(e.target.error.name, 'VersionError', 'e.target.error.name')
            open_rq2.result.close();
            t.done();
        });
        open_rq3.onupgradeneeded = fail(t, 'Unexpected upgradeneeded')
        open_rq3.onsuccess = fail(t, 'Unexpected success')
    }
}, "IDBFactory.open() - open database with a lower version than current");

async_test(t => {
    const open_rq = createdb(t, undefined, 13);
    let did_upgrade = false;
    let open_rq2;

    open_rq.onupgradeneeded = function () { };
    open_rq.onsuccess = function (e) {
        let db = e.target.result;
        db.close();

        open_rq2 = indexedDB.open(db.name, 14);
        open_rq2.onupgradeneeded = function () {
            did_upgrade = true;
        };
        open_rq2.onsuccess = t.step_func(open_current_db);
        open_rq2.onerror = fail(t, 'Unexpected error')
    }

    function open_current_db(e) {
        let open_rq3 = indexedDB.open(e.target.result.name);
        open_rq3.onsuccess = t.step_func(function (e) {
            assert_equals(e.target.result.version, 14, "db.version")
            open_rq2.result.close();
            open_rq3.result.close();
            t.done();
        });
        open_rq3.onupgradeneeded = fail(t, 'Unexpected upgradeneeded')
        open_rq3.onerror = fail(t, 'Unexpected error')

        assert_true(did_upgrade, 'did upgrade');
    }
}, "IDBFactory.open() - open database with a higher version than current");

async_test(t => {
    const open_rq = createdb(t, undefined, 13);
    let did_upgrade = false;
    let did_db_abort = false;

    open_rq.onupgradeneeded = function (e) {
        did_upgrade = true;
        e.target.result.onabort = function () {
            did_db_abort = true;
        }
        e.target.transaction.abort();
    };
    open_rq.onerror = function (e) {
        assert_true(did_upgrade);
        assert_equals(e.target.error.name, 'AbortError', 'target.error');
        t.done()
    };
}, "IDBFactory.open() - error in version change transaction aborts open");

function should_throw(val, name) {
    if (!name) {
        name = ((typeof val == "object" && val) ? "object" : format_value(val))
    }
    test(function () {
        assert_throws_js(TypeError, function () {
            indexedDB.open('test', val);
        });
    }, "Calling open() with version argument " + name + " should throw TypeError.")
}

should_throw(-1)
should_throw(-0.5)
should_throw(0)
should_throw(0.5)
should_throw(0.8)
should_throw(0x20000000000000)  // Number.MAX_SAFE_INTEGER + 1
should_throw(NaN)
should_throw(Infinity)
should_throw(-Infinity)
should_throw("foo")
should_throw(null)
should_throw(false)

should_throw({
    toString: function () { assert_unreached("toString should not be called for ToPrimitive [Number]"); },
    valueOf: function () { return 0; }
})
should_throw({
    toString: function () { return 0; },
    valueOf: function () { return {}; }
}, 'object (second)')
should_throw({
    toString: function () { return {}; },
    valueOf: function () { return {}; },
}, 'object (third)')


/* Valid */

function should_work(val, expected_version) {
    let name = format_value(val);
    let dbname = 'test-db-does-not-exist';
    async_test(function (t) {
        indexedDB.deleteDatabase(dbname);
        let rq = indexedDB.open(dbname, val);
        rq.onupgradeneeded = t.step_func(function () {
            let db = rq.result;
            assert_equals(db.version, expected_version, 'version');
            rq.transaction.abort();
        });
        rq.onsuccess = t.unreached_func("open should fail");
        rq.onerror = t.step_func(function () {
            t.done()
        });
    }, "Calling open() with version argument " + name + " should not throw.");
}

should_work(1.5, 1)
should_work(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)  // 0x20000000000000 - 1
should_work(undefined, 1);

async_test(t => {
    let db, db2;
    const open_rq = createdb(t, undefined, 9);

    open_rq.onupgradeneeded = function (e) {
        db = e.target.result;

        let st = db.createObjectStore("store");
        st.createIndex("index", "i");

        assert_equals(db.version, 9, "first db.version");
        assert_true(db.objectStoreNames.contains("store"), "objectStoreNames contains store");
        assert_true(st.indexNames.contains("index"), "indexNames contains index");

        st.add({ i: "Joshua" }, 1);
        st.add({ i: "Jonas" }, 2);
    };
    open_rq.onsuccess = function (e) {
        db.close();
        let open_rq2 = indexedDB.open(db.name, 10);
        open_rq2.onupgradeneeded = t.step_func(function (e) {
            db2 = e.target.result;

            db2.createObjectStore("store2");

            let store = open_rq2.transaction.objectStore("store")
            store.createIndex("index2", "i");

            assert_equals(db2.version, 10, "db2.version");

            assert_true(db2.objectStoreNames.contains("store"), "second objectStoreNames contains store");
            assert_true(db2.objectStoreNames.contains("store2"), "second objectStoreNames contains store2");
            assert_true(store.indexNames.contains("index"), "second indexNames contains index");
            assert_true(store.indexNames.contains("index2"), "second indexNames contains index2");

            store.add({ i: "Odin" }, 3);
            store.put({ i: "Sicking" }, 2);

            open_rq2.transaction.abort();
        });
        open_rq2.onerror = t.step_func(function (e) {
            assert_equals(db2.version, 9, "db2.version after error");
            assert_true(db2.objectStoreNames.contains("store"), "objectStoreNames contains store after error");
            assert_false(db2.objectStoreNames.contains("store2"), "objectStoreNames not contains store2 after error");

            let open_rq3 = indexedDB.open(db.name);
            open_rq3.onsuccess = t
                .step_func(function (e) {
                    let db3 = e.target.result;

                    assert_true(db3.objectStoreNames.contains("store"), "third objectStoreNames contains store");
                    assert_false(db3.objectStoreNames.contains("store2"), "third objectStoreNames contains store2");

                    let st = db3.transaction("store", "readonly").objectStore("store");

                    assert_equals(db3.version, 9, "db3.version");

                    assert_true(st.indexNames.contains("index"), "third indexNames contains index");
                    assert_false(st.indexNames.contains("index2"), "third indexNames contains index2");

                    st.openCursor(null, "prev").onsuccess = t.step_func(function (e) {
                        assert_equals(e.target.result.key, 2, "opencursor(prev) key");
                        assert_equals(e.target.result.value.i, "Jonas", "opencursor(prev) value");
                    });
                    st.get(3).onsuccess = t.step_func(function (e) {
                        assert_equals(e.target.result, undefined, "get(3)");
                    });

                    let idx = st.index("index");
                    idx.getKey("Jonas").onsuccess = t.step_func(function (e) {
                        assert_equals(e.target.result, 2, "getKey(Jonas)");
                    });
                    idx.getKey("Odin").onsuccess = t.step_func(function (e) {
                        assert_equals(e.target.result, undefined, "getKey(Odin)");
                    });
                    idx.getKey("Sicking").onsuccess = t.step_func(function (e) {
                        assert_equals(e.target.result, undefined, "getKey(Sicking)");

                        db3.close();
                        t.done();
                    });
                });
        });
    };
}, "IDBFactory.open() - error in upgradeneeded resets db");

async_test(t => {
    let db;
    let count_done = 0;
    const open_rq = createdb(t);

    open_rq.onupgradeneeded = function (e) {
        db = e.target.result;

        db.createObjectStore("store");
        assert_true(db.objectStoreNames.contains("store"), "objectStoreNames contains store");

        let store = e.target.transaction.objectStore("store");
        assert_equals(store.name, "store", "store.name");

        store.add("data", 1);

        store.count().onsuccess = t.step_func(function (e) {
            assert_equals(e.target.result, 1, "count()");
            count_done++;
        });

        store.add("data2", 2);
    };
    open_rq.onsuccess = function (e) {
        let store = db.transaction("store", "readonly").objectStore("store");
        assert_equals(store.name, "store", "store.name");
        store.count().onsuccess = t.step_func(function (e) {
            assert_equals(e.target.result, 2, "count()");
            count_done++;
        });
        db.close();

        let open_rq2 = indexedDB.open(db.name, 10);
        open_rq2.onupgradeneeded = t.step_func(function (e) {
            let db2 = e.target.result;
            assert_true(db2.objectStoreNames.contains("store"), "objectStoreNames contains store");
            let store = open_rq2.transaction.objectStore("store");
            assert_equals(store.name, "store", "store.name");

            store.add("data3", 3);

            store.count().onsuccess = t.step_func(function (e) {
                assert_equals(e.target.result, 3, "count()");
                count_done++;

                assert_equals(count_done, 3, "count_done");

                db2.close();
                t.done();
            });
        });
    };
}, "IDBFactory.open() - second open's transaction is available to get objectStores");

async_test(t => {
    let db;
    let open_rq = createdb(t, undefined, 9);
    let open2_t = t;

    open_rq.onupgradeneeded = function (e) {
        db = e.target.result;

        assert_true(e instanceof IDBVersionChangeEvent, "e instanceof IDBVersionChangeEvent");
        assert_equals(e.oldVersion, 0, "oldVersion");
        assert_equals(e.newVersion, 9, "newVersion");
        assert_equals(e.type, "upgradeneeded", "event type");

        assert_equals(db.version, 9, "db.version");
    };
    open_rq.onsuccess = function (e) {
        assert_true(e instanceof Event, "e instanceof Event");
        assert_false(e instanceof IDBVersionChangeEvent, "e not instanceof IDBVersionChangeEvent");
        assert_equals(e.type, "success", "event type");
        t.done();


        /**
         * Second test
         */
        db.onversionchange = function () { db.close(); };

        let open_rq2 = createdb(open2_t, db.name, 10);
        open_rq2.onupgradeneeded = function (e) {
            let db2 = e.target.result;
            assert_true(e instanceof IDBVersionChangeEvent, "e instanceof IDBVersionChangeEvent");
            assert_equals(e.oldVersion, 9, "oldVersion");
            assert_equals(e.newVersion, 10, "newVersion");
            assert_equals(e.type, "upgradeneeded", "event type");

            assert_equals(db2.version, 10, "new db.version");

            t.done();
        };
    };
}, "IDBFactory.open() - upgradeneeded gets VersionChangeEvent");