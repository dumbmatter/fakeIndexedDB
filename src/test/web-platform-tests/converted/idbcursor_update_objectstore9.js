require("../support-node");

var db,
    t = async_test(),
    records = [
        { pKey: "primaryKey_0", value: "value_0" },
        { pKey: "primaryKey_1", value: "value_1" },
    ];

var open_rq = createdb(t);
open_rq.onupgradeneeded = function(event) {
    db = event.target.result;

    var objStore = db.createObjectStore("store", { keyPath: "pKey" });

    for (var i = 0; i < records.length; i++) {
        objStore.add(records[i]);
    }
};

open_rq.onsuccess = function(e) {
    var cursor_rq = db
        .transaction("store", "readwrite")
        .objectStore("store")
        .openCursor();

    cursor_rq.onsuccess = t.step_func(function(event) {
        var cursor = event.target.result;
        assert_true(cursor instanceof IDBCursor, "cursor exists");

        cursor.continue();
        assert_throws("InvalidStateError", function() {
            cursor.update({ pKey: "primaryKey_0", value: "value_0_updated" });
        });

        t.done();
    });
};
