require("../../build/global.js");
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;


var db;
var versionchange_fired;
var blocked_fired;
var upgradeneeded_fired;
var t = async_test();
var open_rq = createdb(t);
var counter = 0;

open_rq.onupgradeneeded = function() {}
open_rq.onsuccess = function(e) {
    db = e.target.result;
    db.onversionchange = t.step_func(function(e) {
        versionchange_fired = counter++;
    });
    var rq = window.indexedDB.open(db.name, db.version + 1);
    rq.onblocked = t.step_func(function (e) {
        blocked_fired = counter++;
        db.close();
    });
    rq.onupgradeneeded = t.step_func(function (e) {
        upgradeneeded_fired = counter++;
    });
    rq.onsuccess = t.step_func(function (e) {
        assert_equals(versionchange_fired, 0, 'versionchange event fired #')
        assert_equals(blocked_fired, 1, 'block event fired #')
        assert_equals(upgradeneeded_fired, 2, 'second upgradeneeded event fired #')

        t.done();
    });
    rq.onerror = fail(t, 'Unexpected database deletion error');
};

