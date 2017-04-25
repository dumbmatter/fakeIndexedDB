require("../support-node");

    // Transaction may fire window.onerror in some implementations.
    setup({allow_uncaught_exception:true});

    var db,
      events = [],
      t = async_test(document.title, {timeout: 10000})

    var open_rq = createdb(t);
    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;
        db.onerror = log("db.error");
        db.onabort = log("db.abort");
        e.target.transaction.onabort = log("transaction.abort")
        e.target.transaction.onerror = log("transaction.error")
        e.target.transaction.oncomplete = log("transaction.complete")

        var txn = e.target.transaction,
          objStore = db.createObjectStore("store");

        var rq_add1 = objStore.add({ animal: "Unicorn" }, 1);
        rq_add1.onsuccess = log("rq_add1.success");
        rq_add1.onerror   = log("rq_add1.error");

        var rq_add2 = objStore.add({ animal: "Unicorn" }, 2);
        rq_add2.onsuccess = log("rq_add2.success");
        rq_add2.onerror   = log("rq_add2.error");

        objStore.createIndex("index", "animal", { unique: true })

        var rq_add3 = objStore.add({ animal: "Unicorn" }, 3);
        rq_add3.onsuccess = log("rq_add3.success");
        rq_add3.onerror   = log("rq_add3.error");
    }

    open_rq.onerror = function(e) {
        log("open_rq.error")(e);
        assert_array_equals(events, [ "rq_add1.success",
                                      "rq_add2.success",

                                      "rq_add3.error: AbortError",
                                      "transaction.error: AbortError",
                                      "db.error: AbortError",

                                      "transaction.abort: ConstraintError",
                                      "db.abort: ConstraintError",

                                      "open_rq.error: AbortError" ],
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
