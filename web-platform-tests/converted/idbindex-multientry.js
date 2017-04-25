require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;


    var db,
        expected_keys = [1, 2, 2, 3, 3];

    var open_rq = createdb(async_test(document.title, {timeout: 10000}))

    open_rq.onupgradeneeded = function(e) {
        db = e.target.result;

        var store = db.createObjectStore("store")

        store.createIndex('actors', 'name', { multiEntry: true })

        store.add({name: 'Odin'}, 1);
        store.add({name: ['Rita', 'Scheeta', {Bobby:'Bobby'}]}, 2);
        store.add({name: [ {s: 'Robert'}, 'Neil', 'Bobby']}, 3);
    };
    open_rq.onsuccess = function(e) {
        var gotten_keys = [];
        var idx = db.transaction('store').objectStore('store').index('actors');

        idx.getKey('Odin').onsuccess = this.step_func(function(e) {
            gotten_keys.push(e.target.result)
        });
        idx.getKey('Rita').onsuccess = this.step_func(function(e) {
            gotten_keys.push(e.target.result)
        });
        idx.getKey('Scheeta').onsuccess = this.step_func(function(e) {
            gotten_keys.push(e.target.result)
        });
        idx.getKey('Neil').onsuccess = this.step_func(function(e) {
            gotten_keys.push(e.target.result)
        });
        idx.getKey('Bobby').onsuccess = this.step_func(function(e) {
            gotten_keys.push(e.target.result)

            assert_array_equals(gotten_keys, expected_keys);
            this.done();
        });
    }
