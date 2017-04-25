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


  test(function() {
    assert_equals(indexedDB.cmp([0], new Uint8Array([0])), 1, "Array > Binary");
  }, "Array v.s. Binary");

  test(function() {
    assert_equals(indexedDB.cmp(new Uint8Array([0]), "0"), 1, "Binary > String");
  }, "Binary v.s. String");

  test(function() {
    assert_equals(indexedDB.cmp("", new Date(0)), 1, "String > Date");
  }, "String v.s. Date");

  test(function() {
    assert_equals(indexedDB.cmp(new Date(0), 0), 1, "Date > Number");
  }, "Date v.s. Number");
