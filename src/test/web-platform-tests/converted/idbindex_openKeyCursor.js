require("../support-node");

var db,
    t = async_test();

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    var store = db.createObjectStore("store", { keyPath: "key" });
    var index = store.createIndex("index", "indexedProperty");

    store.add({ key: 1, indexedProperty: "data" });

    assert_throws("DataError", function() {
        index.openKeyCursor(NaN);
    });
    t.done();
};
