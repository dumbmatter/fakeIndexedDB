require("../support-node");


    var db,
      t = async_test(document.title, {timeout: 10000})

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        var objStore = db.createObjectStore("test");

        objStore.add("data", "key");
    };

    open_rq.onsuccess = t.step_func(function(e) {
        var txn = db.transaction("test", "readwrite"),
          cursor_rq = txn.objectStore("test")
                         .openCursor();

        cursor_rq.onsuccess = t.step_func(function(e) {
            var cursor = e.target.result;

            cursor.value = "new data!";
            cursor.update(cursor.value).onsuccess = t.step_func(function(e) {
                assert_equals(e.target.result, "key");
                t.done();
            });
        });
    });

