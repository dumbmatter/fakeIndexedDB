require("../support-node");

var db,
    t = async_test(document.title, { timeout: 10000 }),
    open_rq = createdb(t);

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    db.createObjectStore("test");
};

open_rq.onsuccess = function(e) {
    assert_throws({ name: "TypeError" }, function() {
        db.transaction("test", "whatever");
    });

    t.done();
};
