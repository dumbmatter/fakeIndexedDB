require("../support-node");

var db,
    t = async_test();

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(event) {
    db = event.target.result;
    db.createObjectStore("store");
};

open_rq.onsuccess = function(event) {
    var txn = db.transaction("store", "readwrite");
    var ostore = txn.objectStore("store");
    t.step(function() {
        assert_throws("InvalidStateError", function() {
            ostore.createIndex("index", "indexedProperty");
        });
    });
    t.done();
};
