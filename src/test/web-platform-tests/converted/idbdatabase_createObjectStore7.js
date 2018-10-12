require("../support-node");

var t = async_test(document.title, { timeout: 10000 }),
    open_rq = createdb(t);

open_rq.onupgradeneeded = function(e) {
    var db = e.target.result;
    db.createObjectStore("with unknown param", { parameter: 0 });

    t.done();
};
