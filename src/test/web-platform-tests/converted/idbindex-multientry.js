require("../support-node");

var db,
    expected_keys = [1, 2, 2, 3, 3];

var open_rq = createdb(async_test(document.title, { timeout: 10000 }));

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;

    var store = db.createObjectStore("store");

    store.createIndex("actors", "name", { multiEntry: true });

    store.add({ name: "Odin" }, 1);
    store.add({ name: ["Rita", "Scheeta", { Bobby: "Bobby" }] }, 2);
    store.add({ name: [{ s: "Robert" }, "Neil", "Bobby"] }, 3);
};
open_rq.onsuccess = function(e) {
    var gotten_keys = [];
    var idx = db
        .transaction("store")
        .objectStore("store")
        .index("actors");

    idx.getKey("Odin").onsuccess = this.step_func(function(e) {
        gotten_keys.push(e.target.result);
    });
    idx.getKey("Rita").onsuccess = this.step_func(function(e) {
        gotten_keys.push(e.target.result);
    });
    idx.getKey("Scheeta").onsuccess = this.step_func(function(e) {
        gotten_keys.push(e.target.result);
    });
    idx.getKey("Neil").onsuccess = this.step_func(function(e) {
        gotten_keys.push(e.target.result);
    });
    idx.getKey("Bobby").onsuccess = this.step_func(function(e) {
        gotten_keys.push(e.target.result);

        assert_array_equals(gotten_keys, expected_keys);
        this.done();
    });
};
