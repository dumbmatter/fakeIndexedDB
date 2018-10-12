require("../support-node");

var db;

createdb(async_test()).onupgradeneeded = function(e) {
    db = e.target.result;

    var store = db.createObjectStore("store", { keyPath: "k" });

    for (var i = 0; i < 5; i++) store.add({ k: "key_" + i });

    store.count("key_2").onsuccess = this.step_func(function(e) {
        assert_equals(e.target.result, 1, "count(key_2)");

        store.count("key_").onsuccess = this.step_func(function(e) {
            assert_equals(e.target.result, 0, "count(key_)");
            this.done();
        });
    });
};
