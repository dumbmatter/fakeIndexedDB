import "../wpt-env.js";

let attrs,cursor,db,store,store2;

globalThis.title = "IDBCursor.continue() - index";

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
// META: title=IDBCursor.continue() - index
// META: script=resources/support.js

'use strict';

function createObjectStoreWithIndexAndPopulate(db, records) {
  let objStore = db.createObjectStore("test", { keyPath: "pKey" });
  objStore.createIndex("index", "iKey");
  for (let i = 0; i < records.length; i++) {
    objStore.add(records[i]);
  }
  return objStore;
}

function setOnUpgradeNeeded(dbObj, records) {
  return function (event) {
    dbObj.db = event.target.result;
    createObjectStoreWithIndexAndPopulate(dbObj.db, records);
  };
}

async_test(t => {
  let dbObj = {};
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" },
    { pKey: "primaryKey_1-2", iKey: "indexKey_1" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = setOnUpgradeNeeded(dbObj, records);

  open_rq.onsuccess = function (e) {
    let cursor_rq = dbObj.db.transaction("test", "readonly")
      .objectStore("test")
      .index("index")
      .openCursor();

    cursor_rq.onsuccess = t.step_func(function (e) {
      let cursor = e.target.result;
      if (!cursor) {
        assert_equals(count, records.length, "cursor run count");
        t.done();
      }

      let record = cursor.value;
      assert_equals(record.pKey, records[count].pKey, "primary key");
      assert_equals(record.iKey, records[count].iKey, "index key");

      cursor.continue();
      count++;
    });
  };
}, "Iterate to the next record");

async_test(t => {
  let dbObj = {};
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = setOnUpgradeNeeded(dbObj, records);

  open_rq.onsuccess = function (e) {
    let cursor_rq = dbObj.db.transaction("test", "readonly")
      .objectStore("test")
      .index("index")
      .openCursor();

    cursor_rq.onsuccess = t.step_func(function (e) {
      let cursor = e.target.result;

      assert_throws_dom("DataError",
        function () { cursor.continue(-1); });

      assert_true(cursor instanceof IDBCursorWithValue, "cursor");

      t.done();
    });
  };
}, "Attempt to pass a key parameter that is not a valid key");

async_test(t => {
  let dbObj = {};
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = setOnUpgradeNeeded(dbObj, records);

  open_rq.onsuccess = function (e) {
    let cursor_rq = dbObj.db.transaction("test", "readonly")
      .objectStore("test")
      .index("index")
      .openCursor(undefined, "next"); // XXX: Fx has issue with "undefined"

    cursor_rq.onsuccess = t.step_func(function (e) {
      let cursor = e.target.result;
      if (!cursor) {
        assert_equals(count, 2, "ran number of times");
        t.done();
      }

      // First time checks key equal, second time checks key less than
      assert_throws_dom("DataError",
        function () { cursor.continue(records[0].iKey); });

      cursor.continue();

      count++;
    });
  };
}, "Attempt to iterate to the previous record when the direction is set for the next record");

async_test(t => {
  let dbObj = {};
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" },
    { pKey: "primaryKey_2", iKey: "indexKey_2" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = setOnUpgradeNeeded(dbObj, records);

  open_rq.onsuccess = function (e) {
    let cursor_rq = dbObj.db.transaction("test", "readonly")
      .objectStore("test")
      .index("index")
      .openCursor(undefined, "prev"); // XXX Fx issues w undefined

    cursor_rq.onsuccess = t.step_func(function (e) {
      let cursor = e.target.result;
      let record = cursor.value;

      switch (count) {
        case 0:
          assert_equals(record.pKey, records[2].pKey, "first pKey");
          assert_equals(record.iKey, records[2].iKey, "first iKey");
          cursor.continue();
          break;

        case 1:
          assert_equals(record.pKey, records[1].pKey, "second pKey");
          assert_equals(record.iKey, records[1].iKey, "second iKey");
          assert_throws_dom("DataError",
            function () { cursor.continue("indexKey_2"); });
          t.done();
          break;

        default:
          assert_unreached("Unexpected count value: " + count);
      }

      count++;
    });
  };
}, "Attempt to iterate to the next record when the direction is set for the previous record");

async_test(t => {
  let dbObj = {};
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" },
    { pKey: "primaryKey_1-2", iKey: "indexKey_1" },
    { pKey: "primaryKey_2", iKey: "indexKey_2" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = setOnUpgradeNeeded(dbObj, records);

  open_rq.onsuccess = function (e) {
    let cursor_rq = dbObj.db.transaction("test", "readonly")
      .objectStore("test")
      .index("index")
      .openCursor(undefined, "prevunique");

    const expected = [
      { pKey: "primaryKey_2", iKey: "indexKey_2" },
      { pKey: "primaryKey_1", iKey: "indexKey_1" },
      { pKey: "primaryKey_0", iKey: "indexKey_0" }
    ];

    cursor_rq.onsuccess = t.step_func(function (e) {
      if (!e.target.result) {
        assert_equals(count, expected.length, 'count');
        t.done();
        return;
      }
      let cursor = e.target.result;
      let record = cursor.value;

      assert_equals(record.pKey, expected[count].pKey, "pKey #" + count);
      assert_equals(record.iKey, expected[count].iKey, "iKey #" + count);

      assert_equals(cursor.key, expected[count].iKey, "cursor.key #" + count);
      assert_equals(cursor.primaryKey, expected[count].pKey, "cursor.primaryKey #" + count);

      count++;
      cursor.continue(expected[count] ? expected[count].iKey : undefined);
    });
  };
}, "Iterate using 'prevunique'");

async_test(t => {
  let dbObj = {};
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" },
    { pKey: "primaryKey_1-2", iKey: "indexKey_1" },
    { pKey: "primaryKey_2", iKey: "indexKey_2" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = setOnUpgradeNeeded(dbObj, records);

  open_rq.onsuccess = function (e) {
    let cursor_rq = dbObj.db.transaction("test", "readonly")
      .objectStore("test")
      .index("index")
      .openCursor(undefined, "nextunique");

    const expected = [
      { pKey: "primaryKey_0", iKey: "indexKey_0" },
      { pKey: "primaryKey_1", iKey: "indexKey_1" },
      { pKey: "primaryKey_2", iKey: "indexKey_2" }
    ];

    cursor_rq.onsuccess = t.step_func(function (e) {
      if (!e.target.result) {
        assert_equals(count, expected.length, 'count');
        t.done();
        return;
      }
      let cursor = e.target.result;
      let record = cursor.value;

      assert_equals(record.pKey, expected[count].pKey, "pKey #" + count);
      assert_equals(record.iKey, expected[count].iKey, "iKey #" + count);

      assert_equals(cursor.key, expected[count].iKey, "cursor.key #" + count);
      assert_equals(cursor.primaryKey, expected[count].pKey, "cursor.primaryKey #" + count);

      count++;
      cursor.continue(expected[count] ? expected[count].iKey : undefined);
    });
  };
}, "Iterate using nextunique");

async_test(t => {
  let db;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = function (event) {
    db = event.target.result;
    let objStore = createObjectStoreWithIndexAndPopulate(db, records);
    let rq = objStore.index("index").openCursor();
    rq.onsuccess = t.step_func(function (event) {
      let cursor = event.target.result;
      assert_true(cursor instanceof IDBCursor);

      event.target.transaction.abort();
      assert_throws_dom("TransactionInactiveError",
        function () { cursor.continue(); });

      t.done();
    });
  }
}, "Calling continue() should throw an exception TransactionInactiveError when the transaction is not active.");

async_test(t => {
  let db;
  const records = [
    { pKey: "primaryKey_0", iKey: "indexKey_0" },
    { pKey: "primaryKey_1", iKey: "indexKey_1" }
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = function (event) {
    db = event.target.result;
    let objStore = createObjectStoreWithIndexAndPopulate(db, records);
    let rq = objStore.index("index").openCursor();
    rq.onsuccess = t.step_func(function (event) {
      let cursor = event.target.result;
      assert_true(cursor instanceof IDBCursor);

      db.deleteObjectStore("test");
      assert_throws_dom("InvalidStateError",
        function () { cursor.continue(); });

      t.done();
    });
  }
}, "If the cursor's source or effective object store has been deleted, the implementation MUST throw a DOMException of type InvalidStateError");

async_test(t => {
  let db;
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", obj: { iKey: "iKey_0" } },
    { pKey: "primaryKey_1", obj: { iKey: "iKey_1" } },
    { pKey: "primaryKey_2", obj: { iKey: "iKey_2" } }
  ];

  const expected = [
    ["primaryKey_2", "iKey_2"],
    ["primaryKey_0", "iKey_0"]
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = function (e) {
    db = e.target.result;
    var objStore = db.createObjectStore("test", { keyPath: ["pKey", "obj.iKey"] });
    objStore.createIndex("index", ["pKey", "obj.iKey"]);

    for (var i = 0; i < records.length; i++)
      objStore.add(records[i]);
  };

  open_rq.onsuccess = function (e) {
    var cursor_rq = db.transaction("test", "readwrite")
      .objectStore("test")
      .index("index")
      .openCursor(null, "prev");

    cursor_rq.onsuccess = t.step_func(function (e) {
      var cursor = e.target.result;
      if (!cursor) {
        assert_equals(count, 2, "cursor run count");
        t.done();
      }

      if (count === 0) {
        e.target.source.objectStore.delete(["primaryKey_1", "iKey_1"]);
      }
      assert_array_equals(cursor.key, expected[count], "primary key");

      cursor.continue();
      count++;
    });
  }
}, "Delete next element, and iterate to it");

async_test(t => {
  let db;
  let count = 0;
  const records = [
    { pKey: "primaryKey_0", obj: { iKey: "iKey_0" } },
    { pKey: "primaryKey_2", obj: { iKey: "iKey_2" } }
  ];

  const expected = [
    ["primaryKey_2", "iKey_2"],
    ["primaryKey_1", "iKey_1"],
    ["primaryKey_0", "iKey_0"]
  ];

  let open_rq = createdb(t);
  open_rq.onupgradeneeded = function (e) {
    db = e.target.result;
    var objStore = db.createObjectStore("test", { keyPath: "pKey" });
    objStore.createIndex("index", ["pKey", "obj.iKey"]);

    for (var i = 0; i < records.length; i++)
      objStore.add(records[i]);
  };

  open_rq.onsuccess = function (e) {
    var cursor_rq = db.transaction("test", "readwrite")
      .objectStore("test")
      .index("index")
      .openCursor(null, "prev");

    cursor_rq.onsuccess = t.step_func(function (e) {
      var cursor = e.target.result;
      if (!cursor) {
        assert_equals(count, 3, "cursor run count");
        t.done();
      }

      if (count === 0) {
        e.target.source.objectStore.add({ pKey: "primaryKey_1", obj: { iKey: "iKey_1" } });
      }
      assert_array_equals(cursor.key, expected[count], "primary key");

      cursor.continue();
      count++;
    });
  }
}, "Add next element, and iterate to it");
