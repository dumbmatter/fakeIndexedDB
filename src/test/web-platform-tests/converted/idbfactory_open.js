require("../support-node");

var open_rq = createdb(async_test(), undefined, 9);

open_rq.onupgradeneeded = function(e) {};
open_rq.onsuccess = function(e) {
    assert_equals(e.target.source, null, "source");
    this.done();
};
