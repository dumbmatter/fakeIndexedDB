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



indexeddb_test(
  function(t, db, tx) {
            var objStore = db.createObjectStore("test");
            objStore.createIndex("index", "");

            objStore.add("data",  1);
            objStore.add("data2", 2);
  },
  function(t, db, tx) {
            var idx = db.transaction("test").objectStore("test").index("index");

            assert_throws("DataError",
                function() { idx.openCursor({ lower: "a" }); });

            assert_throws("DataError",
                function() { idx.openCursor({ lower: "a", lowerOpen: false }); });

            assert_throws("DataError",
                function() { idx.openCursor({ lower: "a", lowerOpen: false, upper: null, upperOpen: false }); });

            t.done();
  },
  document.title + " - pass something other than number"
);
