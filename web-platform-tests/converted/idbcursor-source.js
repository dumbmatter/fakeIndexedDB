require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_key_equals,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    promise_test,
    setup,
    step_timeout,
    test,
} = require("../support-node");

const document = {};
const window = global;


function cursor_source_test(test_name, name, stringified_object, cursor_rq_func) {
  indexeddb_test(
    function(t, db, tx) {
      var objStore = db.createObjectStore("my_objectstore");
      objStore.createIndex("my_index", "");

      objStore.add("data",  1);
      objStore.add("data2", 2);
    },
    function(t, db) {
      var cursor_rq = cursor_rq_func(db);

      cursor_rq.onsuccess = t.step_func(function(e) {
        if (!e.target.result) {
          return;
        }
        var cursor = e.target.result;
        assert_readonly(cursor, 'source');

        // Direct try
        assert_true(cursor.source instanceof Object, "source isobject");
        assert_equals(cursor.source + "", stringified_object, "source");
        assert_equals(cursor.source.name, name, "name");

        cursor.continue();
      });

      cursor_rq.transaction.oncomplete = t.step_func(function(e) {
        t.done();
      });

      cursor_rq.transaction.onerror = t.step_func(function(e) {
        assert_unreached("Transaction got error. " + (e.target.error ? e.target.error.name : "unknown"));
      });
    },
    test_name
  );
}

cursor_source_test(
  document.title + ' - IDBObjectStore',
  "my_objectstore",
  "[object IDBObjectStore]",
  function(db) { return db.transaction("my_objectstore")
                          .objectStore("my_objectstore")
                          .openCursor(); }
);

cursor_source_test(
  document.title + ' - IDBIndex',
  "my_index",
  "[object IDBIndex]",
  function(db) { return db.transaction("my_objectstore")
                          .objectStore("my_objectstore")
                          .index("my_index")
                          .openCursor(); }
);
