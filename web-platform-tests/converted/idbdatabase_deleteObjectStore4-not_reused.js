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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;



var t = async_test(document.title, {timeout: 10000}),
    keys = [],
    open_rq = createdb(t)

open_rq.onupgradeneeded = function(e) {
    var db = e.target.result

    var objStore = db.createObjectStore("resurrected", { autoIncrement: true, keyPath: "k" });
    objStore.add({k:5}).onsuccess = function(e) { keys.push(e.target.result); }
    objStore.add({}).onsuccess = function(e) { keys.push(e.target.result); }
    objStore.createIndex("idx", "i");
    assert_true(objStore.indexNames.contains("idx"));
    assert_equals(objStore.keyPath, "k", "keyPath");

    db.deleteObjectStore("resurrected");

    var objStore2 = db.createObjectStore("resurrected", { autoIncrement: true });
    objStore2.add("Unicorns'R'us").onsuccess = function(e) { keys.push(e.target.result); };
    assert_false(objStore2.indexNames.contains("idx"), "index exist on new objstore");
    assert_equals(objStore2.keyPath, null, "keyPath");

    assert_throws("NotFoundError", function() { objStore2.index("idx"); });
}

open_rq.onsuccess = function(e) {
    assert_array_equals(keys, [5, 6, 1], "keys");
    t.done();
}

