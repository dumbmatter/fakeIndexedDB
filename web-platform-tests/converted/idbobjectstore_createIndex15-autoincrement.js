require("../../build/global.js");
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
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;


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
