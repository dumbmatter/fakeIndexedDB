require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_key_equals,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    promise_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db,
      events = [],
      t = async_test(document.title, {timeout: 10000})

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        e.target.transaction.oncomplete = log("transaction.complete");

        var txn = e.target.transaction,
          objStore = db.createObjectStore("store");

        var rq_add1 = objStore.add({ animal: "Unicorn" }, 1);
        rq_add1.onsuccess = log("rq_add1.success");
        rq_add1.onerror   = log("rq_add1.error");

        objStore.createIndex("index", "animal", { unique: true });

        var rq_add2 = objStore.add({ animal: "Unicorn" }, 2);
        rq_add2.onsuccess = log("rq_add2.success");
        rq_add2.onerror   = function(e) {
            log("rq_add2.error")(e);
            e.preventDefault();
            e.stopPropagation();
        }

        objStore.deleteIndex("index");

        var rq_add3 = objStore.add({ animal: "Unicorn" }, 3);
        rq_add3.onsuccess = log("rq_add3.success");
        rq_add3.onerror   = log("rq_add3.error");
    }

    open_rq.onsuccess = function(e) {
        log("open_rq.success")(e);
        assert_array_equals(events, [ "rq_add1.success",
                                      "rq_add2.error: ConstraintError",
                                      "rq_add3.success",

                                      "transaction.complete",

                                      "open_rq.success" ],
                            "events");
        t.done();
    }

    function log(msg) {
        return function(e) {
            if(e && e.target && e.target.error)
                events.push(msg + ": " + e.target.error.name);
            else
                events.push(msg);
        };
    }
