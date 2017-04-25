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
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;



    var db, trans, store, index;
    var t = async_test();

    var request = createdb(t);
    request.onupgradeneeded = function(e) {
        db = request.result;
        store = db.createObjectStore('store');
        index = store.createIndex('index', 'value');
        store.put({value: 0}, 0);
        trans = request.transaction;
        trans.oncomplete = verifyOverloads;
    };

    function verifyOverloads() {
        trans = db.transaction('store');
        store = trans.objectStore('store');
        index = store.index('index');

        checkCursorDirection("store.openCursor()", "next");
        checkCursorDirection("store.openCursor(0)", "next");
        checkCursorDirection("store.openCursor(0, 'next')", "next");
        checkCursorDirection("store.openCursor(0, 'nextunique')", "nextunique");
        checkCursorDirection("store.openCursor(0, 'prev')", "prev");
        checkCursorDirection("store.openCursor(0, 'prevunique')", "prevunique");

        checkCursorDirection("store.openCursor(IDBKeyRange.only(0))", "next");
        checkCursorDirection("store.openCursor(IDBKeyRange.only(0), 'next')", "next");
        checkCursorDirection("store.openCursor(IDBKeyRange.only(0), 'nextunique')", "nextunique");
        checkCursorDirection("store.openCursor(IDBKeyRange.only(0), 'prev')", "prev");
        checkCursorDirection("store.openCursor(IDBKeyRange.only(0), 'prevunique')", "prevunique");

        checkCursorDirection("index.openCursor()", "next");
        checkCursorDirection("index.openCursor(0)", "next");
        checkCursorDirection("index.openCursor(0, 'next')", "next");
        checkCursorDirection("index.openCursor(0, 'nextunique')", "nextunique");
        checkCursorDirection("index.openCursor(0, 'prev')", "prev");
        checkCursorDirection("index.openCursor(0, 'prevunique')", "prevunique");

        checkCursorDirection("index.openCursor(IDBKeyRange.only(0))", "next");
        checkCursorDirection("index.openCursor(IDBKeyRange.only(0), 'next')", "next");
        checkCursorDirection("index.openCursor(IDBKeyRange.only(0), 'nextunique')", "nextunique");
        checkCursorDirection("index.openCursor(IDBKeyRange.only(0), 'prev')", "prev");
        checkCursorDirection("index.openCursor(IDBKeyRange.only(0), 'prevunique')", "prevunique");

        checkCursorDirection("index.openKeyCursor()", "next");
        checkCursorDirection("index.openKeyCursor(0)", "next");
        checkCursorDirection("index.openKeyCursor(0, 'next')", "next");
        checkCursorDirection("index.openKeyCursor(0, 'nextunique')", "nextunique");
        checkCursorDirection("index.openKeyCursor(0, 'prev')", "prev");
        checkCursorDirection("index.openKeyCursor(0, 'prevunique')", "prevunique");

        checkCursorDirection("index.openKeyCursor(IDBKeyRange.only(0))", "next");
        checkCursorDirection("index.openKeyCursor(IDBKeyRange.only(0), 'next')", "next");
        checkCursorDirection("index.openKeyCursor(IDBKeyRange.only(0), 'nextunique')", "nextunique");
        checkCursorDirection("index.openKeyCursor(IDBKeyRange.only(0), 'prev')", "prev");
        checkCursorDirection("index.openKeyCursor(IDBKeyRange.only(0), 'prevunique')", "prevunique");

        t.done();
    }

    function checkCursorDirection(statement, direction) {
        request = eval(statement);
        request.onsuccess = function(event) {
            assert_not_equals(event.target.result, null, "Check the result is not null")
            assert_equals(event.target.result.direction, direction, "Check the result direction");
        };
    }

