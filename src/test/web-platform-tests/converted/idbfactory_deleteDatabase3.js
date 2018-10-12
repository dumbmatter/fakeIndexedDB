require("../support-node");

var db;
var open_rq = createdb(
    async_test(document.title, { timeout: 10000 }),
    undefined,
    9,
);

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    db.createObjectStore("os");
};
open_rq.onsuccess = function(e) {
    db.close();

    var delete_rq = window.indexedDB.deleteDatabase(db.name);
    delete_rq.onerror = fail(this, "Unexpected delete_rq.error event");
    delete_rq.onsuccess = this.step_func(function(e) {
        assert_equals(e.oldVersion, 9, "oldVersion");
        assert_equals(e.newVersion, null, "newVersion");
        assert_equals(e.target.result, undefined, "result");
        assert_true(
            e instanceof IDBVersionChangeEvent,
            "e instanceof IDBVersionChangeEvent",
        );
        this.done();
    });
};
