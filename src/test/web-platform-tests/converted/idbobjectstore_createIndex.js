require("../support-node");

var db,
    t = async_test();

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    var objStore = db.createObjectStore("store");
    var index = objStore.createIndex("index", "indexedProperty", {
        unique: true,
    });

    assert_true(index instanceof IDBIndex, "IDBIndex");
    assert_equals(index.name, "index", "name");
    assert_equals(index.objectStore, objStore, "objectStore");
    assert_equals(index.keyPath, "indexedProperty", "keyPath");
    assert_true(index.unique, "unique");
    assert_false(index.multiEntry, "multiEntry");

    t.done();
};
