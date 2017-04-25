require("../support-node");

    var open_rq = createdb(async_test(), 'database_name', 13);

    open_rq.onupgradeneeded = function(e) {};
    open_rq.onsuccess = function(e) {
        var db = e.target.result;
        assert_equals(db.name, 'database_name', 'db.name');
        assert_equals(db.version, 13, 'db.version');
        this.done();
    }
