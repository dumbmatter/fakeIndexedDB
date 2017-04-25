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
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db,
      t = async_test();

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("store", { autoIncrement: true });
        objStore.createIndex("index", "indexedProperty");

        objStore.add({ indexedProperty: "data" });
        objStore.add({ indexedProperty: "yo, man", something_different: "Yup, totally different" });
        objStore.add({ indexedProperty: 1234 });
        objStore.add({ indexedProperty: [1, 2, 1234] });
        objStore.add(1234);

        objStore.clear().onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result, undefined);
        });
    };

    open_rq.onsuccess = function(e) {
        var rq = db.transaction("store")
                   .objectStore("store")
                   .index("index")
                   .openCursor();

        rq.onsuccess = t.step_func(function(e) {
            assert_equals(e.target.result, null, 'cursor');
            t.done();
        });
    };
