require("../support-node");

    test( function() {
        assert_throws(new TypeError(), function() {
            indexedDB.cmp();
        });
    }, "IDBFactory.cmp() - no argument");

    test( function() {
        assert_throws("DataError", function() {
            indexedDB.cmp(null, null);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(1, null);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(null, 1);
        });
    }, "IDBFactory.cmp() - null");

    test( function() {
        assert_throws("DataError", function() {
            indexedDB.cmp(NaN, NaN);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(1, NaN);
        });
        assert_throws("DataError", function() {
            indexedDB.cmp(NaN, 1);
        });
    }, "IDBFactory.cmp() - NaN");
