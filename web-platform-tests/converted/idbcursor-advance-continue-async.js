require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;



function upgrade_func(t, db, tx) {
  var objStore = db.createObjectStore("test");
  objStore.createIndex("index", "");

  objStore.add("data",  1);
  objStore.add("data2", 2);
}

indexeddb_test(
  upgrade_func,
  function(t, db) {
    var count = 0;
    var rq = db.transaction("test").objectStore("test").openCursor();

    rq.onsuccess = t.step_func(function(e) {
      if (!e.target.result) {
        assert_equals(count, 2, 'count');
        t.done();
        return;
      }
      var cursor = e.target.result;

      switch(count) {
        case 0:
          assert_equals(cursor.value, "data")
          assert_equals(cursor.key, 1)
          cursor.advance(1)
          assert_equals(cursor.value, "data")
          assert_equals(cursor.key, 1)
          break

        case 1:
          assert_equals(cursor.value, "data2")
          assert_equals(cursor.key, 2)
          cursor.advance(1)
          assert_equals(cursor.value, "data2")
          assert_equals(cursor.key, 2)
          break

        default:
          assert_unreached("Unexpected count: " + count)
      }

      count++;
    });
    rq.onerror = t.unreached_func("unexpected error")
  },
  document.title + " - advance"
);

indexeddb_test(
  upgrade_func,
  function(t, db) {
    var count = 0;
    var rq = db.transaction("test").objectStore("test").index("index").openCursor();

    rq.onsuccess = t.step_func(function(e) {
      if (!e.target.result) {
        assert_equals(count, 2, 'count');
        t.done();
        return;
      }
      var cursor = e.target.result;

      switch(count) {
        case 0:
          assert_equals(cursor.value, "data")
          assert_equals(cursor.key,   "data")
          assert_equals(cursor.primaryKey, 1)
          cursor.continue("data2")
          assert_equals(cursor.value, "data")
          assert_equals(cursor.key,   "data")
          assert_equals(cursor.primaryKey, 1)
          break

        case 1:
          assert_equals(cursor.value, "data2")
          assert_equals(cursor.key,   "data2")
          assert_equals(cursor.primaryKey, 2)
          cursor.continue()
          assert_equals(cursor.value, "data2")
          assert_equals(cursor.key,   "data2")
          assert_equals(cursor.primaryKey, 2)
          break

        default:
          assert_unreached("Unexpected count: " + count)
      }

      count++;
    });
    rq.onerror = t.unreached_func("unexpected error")
  },
  document.title + " - continue"
);

indexeddb_test(
  upgrade_func,
  function(t, db) {
    var count = 0;
    var rq = db.transaction("test").objectStore("test").index("index").openCursor();

    rq.onsuccess = t.step_func(function(e) {
      if (!e.target.result) {
        assert_equals(count, 2, 'count');
        t.done();
        return;
      }
      var cursor = e.target.result;
      cursor.advance(1)

      switch(count) {
        case 0:
          assert_equals(cursor.value, "data")
          assert_equals(cursor.key,   "data")
          assert_equals(cursor.primaryKey, 1)
          break

        case 1:
          assert_equals(cursor.value, "data2")
          assert_equals(cursor.key,   "data2")
          assert_equals(cursor.primaryKey, 2)
          break

        default:
          assert_unreached("Unexpected count: " + count)
      }

      count++;
    });
    rq.onerror = t.unreached_func("unexpected error")
  },
  document.title + " - fresh advance still async"
);

indexeddb_test(
  upgrade_func,
  function(t, db) {
    var count = 0;
    var rq = db.transaction("test").objectStore("test").openCursor();

    rq.onsuccess = t.step_func(function(e) {
      if (!e.target.result) {
        assert_equals(count, 2, 'count');
        t.done();
        return;
      }
      var cursor = e.target.result;
      cursor.continue()

      switch(count) {
        case 0:
          assert_equals(cursor.value, "data")
          assert_equals(cursor.key, 1)
          break

        case 1:
          assert_equals(cursor.value, "data2")
          assert_equals(cursor.key, 2)
          break

        default:
          assert_unreached("Unexpected count: " + count)
      }

      count++;
    });
    rq.onerror = t.unreached_func("unexpected error")
  },
  document.title + " - fresh continue still async"
);
