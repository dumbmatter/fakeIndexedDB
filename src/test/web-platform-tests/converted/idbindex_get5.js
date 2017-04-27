require("../support-node");

    var db,
        t = async_test();

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;

        var index = db.createObjectStore("test", { keyPath: "key" })
                      .createIndex("index", "indexedProperty");
        assert_throws("DataError",function(){
            index.get(NaN);
        });
        t.done();
    };
