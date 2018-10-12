require("../support-node");

var db,
    t = async_test(),
    open_rq = createdb(t);

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    db.createObjectStore("readonly");
};
open_rq.onsuccess = function(e) {
    var txn = db.transaction("readonly");
    assert_equals(txn.mode, "readonly", "txn.mode");

    t.done();
};
