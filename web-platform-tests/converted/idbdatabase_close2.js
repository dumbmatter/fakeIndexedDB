require("../support-node");


var db;
var blocked_fired = false;
var versionchange_fired = false;
var t = async_test();
var open_rq = createdb(t);

open_rq.onupgradeneeded = t.step_func(function() {});
open_rq.onsuccess = t.step_func(function(e) {
    db = e.target.result;

    db.onversionchange = t.step_func(function (e) {
      versionchange_fired = true;
    });

    var rq = window.indexedDB.deleteDatabase(db.name);
    rq.onblocked = t.step_func(function (e) {
        blocked_fired = true;
        db.close();
    });
    rq.onsuccess = t.step_func(function (e) {
        assert_true(versionchange_fired, "versionchange event fired")
        assert_true(blocked_fired, "block event fired")
        t.done();
    });
    rq.onerror = fail(t, 'Unexpected database deletion error');
});

