require("../support-node");

var db;
var open_rq = createdb(async_test());

open_rq.onupgradeneeded = function(e) {
    db = e.target.result;
    var os = db.createObjectStore("test");

    os.add("data", "k");
    os.add("data2", "k2");
};

open_rq.onsuccess = function(e) {
    var cursor;
    var count = 0;
    var rq = db
        .transaction("test")
        .objectStore("test")
        .openCursor();

    rq.onsuccess = this.step_func(function(e) {
        switch (count) {
            case 0:
                cursor = e.target.result;

                assert_equals(cursor.value, "data", "prequisite cursor.value");
                cursor.custom_cursor_value = 1;
                e.target.custom_request_value = 2;

                cursor.continue();
                break;

            case 1:
                assert_equals(cursor.value, "data2", "prequisite cursor.value");
                assert_equals(
                    cursor.custom_cursor_value,
                    1,
                    "custom cursor value",
                );
                assert_equals(
                    e.target.custom_request_value,
                    2,
                    "custom request value",
                );

                cursor.advance(1);
                break;

            case 2:
                assert_false(!!e.target.result, "got cursor");
                assert_equals(
                    cursor.custom_cursor_value,
                    1,
                    "custom cursor value",
                );
                assert_equals(
                    e.target.custom_request_value,
                    2,
                    "custom request value",
                );
                break;
        }
        count++;
    });

    rq.transaction.oncomplete = this.step_func(function() {
        assert_equals(count, 3, "cursor callback runs");
        assert_equals(
            rq.custom_request_value,
            2,
            "variable placed on old IDBRequest",
        );
        assert_equals(
            cursor.custom_cursor_value,
            1,
            "custom cursor value (transaction.complete)",
        );
        this.done();
    });
};
