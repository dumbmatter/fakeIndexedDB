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


    function list_order(desc, unsorted, expected) {
        var objStore, db,
          t = async_test(document.title + " - " + desc);

        var open_rq = createdb(t);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            for (var i = 0; i < unsorted.length; i++)
                objStore = db.createObjectStore(unsorted[i]);

            assert_equals(db.objectStoreNames.length, expected.length, "objectStoreNames length");
            for (var i = 0; i < expected.length; i++)
               assert_equals(db.objectStoreNames[i], expected[i], "objectStoreNames["+i+"]");

            for (var i = 0; i < unsorted.length; i++)
                objStore.createIndex(unsorted[i], "length");

            assert_equals(objStore.indexNames.length, expected.length, "indexNames length");
            for (var i = 0; i < expected.length; i++)
                assert_equals(objStore.indexNames[i], expected[i], "indexNames["+i+"]");
        };

        open_rq.onsuccess = function(e) {
            assert_equals(db.objectStoreNames.length, expected.length, "objectStoreNames length");
            for (var i = 0; i < expected.length; i++)
                assert_equals(db.objectStoreNames[i], expected[i], "objectStoreNames["+i+"]");

            assert_equals(objStore.indexNames.length, expected.length, "indexNames length");
            for (var i = 0; i < expected.length; i++)
                assert_equals(objStore.indexNames[i], expected[i], "indexNames["+i+"]");

            t.done();
        };
    }

    list_order("numbers",
        [123456, -12345, -123, 123, 1234, -1234, 0, 12345, -123456],
        ["-123", "-1234", "-12345", "-123456", "0", "123", "1234", "12345", "123456"]);

    list_order("numbers 'overflow'",
        [9, 1, 1000000000, 200000000000000000],
        ["1", "1000000000", "200000000000000000", "9"]);

    list_order("lexigraphical string sort",
        [ "cc", "c", "aa", "a", "bb", "b", "ab", "", "ac" ],
        [ "", "a", "aa", "ab", "ac", "b", "bb", "c", "cc" ]);

