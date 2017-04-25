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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;


  test(function() {
    assert_equals(indexedDB.cmp(new Int8Array([-1]), new Uint8Array([0])), 1,
    "255(-1) shall be larger than 0");
  }, "Compare in unsigned octet values (in the range [0, 255])");

  test(function() {
    assert_equals(indexedDB.cmp(
        new Uint8Array([255, 254, 253]),
        new Uint8Array([255, 253, 254])),
        1,
        "[255, 254, 253] shall be larger than [255, 253, 254]");
  }, "Compare values in then same length");

  test(function() {
    assert_equals(indexedDB.cmp(
        new Uint8Array([255, 254]),
        new Uint8Array([255, 253, 254])),
        1,
        "[255, 254] shall be larger than [255, 253, 254]");
  }, "Compare values in different lengths");

  test(function() {
    assert_equals(indexedDB.cmp(
        new Uint8Array([255, 253, 254]),
        new Uint8Array([255, 253])),
        1,
        "[255, 253, 254] shall be larger than [255, 253]");
  }, "Compare when the values in the range of their minimal length are the same");
