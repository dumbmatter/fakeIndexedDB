require("../support-node");

var db,
    t = async_test();

var open_rq = createdb(t);

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    var store = db.createObjectStore("store", { autoIncrement: true });
    store.createIndex("index", "indexedProperty");

    for (var i = 0; i < 10; i++) {
        store.add({ indexedProperty: "data" + i });
    }
};

open_rq.onsuccess = function(e) {
    var rq = db
        .transaction("store")
        .objectStore("store")
        .index("index")
        .count(IDBKeyRange.bound("data0", "data4"));

    rq.onsuccess = t.step_func(function(e) {
        assert_equals(e.target.result, 5);
        t.done();
    });
};
