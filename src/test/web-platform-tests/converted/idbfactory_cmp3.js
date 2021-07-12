import "../wpt-env.js";

test(function () {
    assert_equals(indexedDB.cmp([0], new Uint8Array([0])), 1, "Array > Binary");
}, "Array v.s. Binary");

test(function () {
    assert_equals(
        indexedDB.cmp(new Uint8Array([0]), "0"),
        1,
        "Binary > String",
    );
}, "Binary v.s. String");

test(function () {
    assert_equals(indexedDB.cmp("", new Date(0)), 1, "String > Date");
}, "String v.s. Date");

test(function () {
    assert_equals(indexedDB.cmp(new Date(0), 0), 1, "Date > Number");
}, "Date v.s. Number");
