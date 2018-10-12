require("../support-node");

var db,
    t = async_test(document.title, { timeout: 10000 });

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    var objStore = db.createObjectStore("test", { keyPath: "key" });
    objStore.createIndex("index", "data");

    assert_equals(objStore.indexNames[0], "index", "indexNames");
    assert_equals(objStore.indexNames.length, 1, "indexNames.length");
};

open_rq.onsuccess = function(e) {
    var objStore = db.transaction("test").objectStore("test");

    assert_equals(objStore.indexNames[0], "index", "indexNames (second)");
    assert_equals(objStore.indexNames.length, 1, "indexNames.length (second)");

    t.done();
};
