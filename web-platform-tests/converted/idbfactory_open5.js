require("../support-node");

    var open_rq = createdb(async_test(), 'database_name');

    open_rq.onupgradeneeded = function() {};
    open_rq.onsuccess = function(e) {
        assert_equals(e.target.result.objectStoreNames.length, 0, "objectStoreNames.length");
        this.done();
    };
