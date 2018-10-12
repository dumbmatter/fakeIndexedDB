require("../support-node");

var db,
    t = async_test(),
    key = 1,
    record = { property: "data" };

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    db.createObjectStore("test").createIndex("index", "indexedProperty");
};

open_rq.onsuccess = function(e) {
    db.close();
    var new_version = createdb(t, db.name, 2);
    new_version.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = e.target.transaction.objectStore("test");
        objStore.deleteIndex("index");
    };
    new_version.onsuccess = function(e) {
        var index,
            objStore = db.transaction("test").objectStore("test");

        assert_throws("NotFoundError", function() {
            index = objStore.index("index");
        });
        assert_equals(index, undefined);
        t.done();
    };
};
