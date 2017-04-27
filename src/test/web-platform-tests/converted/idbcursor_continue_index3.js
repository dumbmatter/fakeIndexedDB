require("../support-node");


    var db,
      t = async_test(),
      records = [ { pKey: "primaryKey_0", iKey: "indexKey_0" },
                  { pKey: "primaryKey_1", iKey: "indexKey_1" } ];

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test", {keyPath:"pKey"});

        objStore.createIndex("index", "iKey");

        for (var i = 0; i < records.length; i++)
            objStore.add(records[i]);
    };

    open_rq.onsuccess = function(e) {
        var count = 0;
        var cursor_rq = db.transaction("test")
                          .objectStore("test")
                          .index("index")
                          .openCursor(undefined, "next"); // XXX: Fx has issue with "undefined"

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;
            if (!cursor) {
                assert_equals(count, 2, "ran number of times");
                t.done();
            }

            // First time checks key equal, second time checks key less than
            assert_throws("DataError",
                function() { cursor.continue(records[0].iKey); });

            cursor.continue();

            count++;
        });
    };

