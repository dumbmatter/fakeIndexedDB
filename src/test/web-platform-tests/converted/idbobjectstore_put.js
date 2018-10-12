require("../support-node");

var db,
    t = async_test(),
    record = { key: 1, property: "data" };

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    var objStore = db.createObjectStore("store", { keyPath: "key" });

    objStore.put(record);
};

open_rq.onsuccess = function(e) {
    var rq = db
        .transaction("store")
        .objectStore("store")
        .get(record.key);

    rq.onsuccess = t.step_func(function(e) {
        assert_equals(e.target.result.property, record.property);
        assert_equals(e.target.result.key, record.key);
        t.done();
    });
};
