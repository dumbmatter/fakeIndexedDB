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


  test(function() {
    let binary = new ArrayBuffer(0);
    let key = IDBKeyRange.lowerBound(binary).lower;

    assert_true(key instanceof ArrayBuffer);
    assert_equals(key.byteLength, 0);
    assert_equals(key.byteLength, binary.byteLength);
  }, "Empty ArrayBuffer");

  test(function() {
    let binary = new ArrayBuffer(4);
    let dataView = new DataView(binary);
    dataView.setUint32(0, 1234567890);

    let key = IDBKeyRange.lowerBound(binary).lower;

    assert_true(key instanceof ArrayBuffer);
    assert_equals(key.byteLength, 4);
    assert_equals(dataView.getUint32(0), new DataView(key).getUint32(0));
  }, "ArrayBuffer");

  test(function() {
    let binary = new ArrayBuffer(4);
    let dataView = new DataView(binary);
    dataView.setUint32(0, 1234567890);

    let key = IDBKeyRange.lowerBound(dataView).lower;

    assert_true(key instanceof ArrayBuffer);
    assert_equals(key.byteLength, 4);
    assert_equals(dataView.getUint32(0), new DataView(key).getUint32(0));
  }, "DataView");

  test(function() {
    let binary = new ArrayBuffer(4);
    let dataView = new DataView(binary);
    let int8Array = new Int8Array(binary);
    int8Array.set([16, -32, 64, -128]);

    let key = IDBKeyRange.lowerBound(int8Array).lower;
    let keyInInt8Array = new Int8Array(key);

    assert_true(key instanceof ArrayBuffer);
    assert_equals(key.byteLength, 4);
    for(let i = 0; i < int8Array.length; i++) {
      assert_equals(keyInInt8Array[i], int8Array[i]);
    }
  }, "TypedArray(Int8Array)");

  test(function() {
    let binary = new ArrayBuffer(4);
    let dataView = new DataView(binary);
    let int8Array = new Int8Array(binary);
    int8Array.set([16, -32, 64, -128]);

    let key = IDBKeyRange.lowerBound([int8Array]).lower;

    assert_true(key instanceof Array);
    assert_true(key[0] instanceof ArrayBuffer);
    assert_equals(key[0].byteLength, 4);

    let keyInInt8Array = new Int8Array(key[0]);

    for(let i = 0; i < int8Array.length; i++) {
      assert_equals(keyInInt8Array[i], int8Array[i]);
    }
  }, "Array of TypedArray(Int8Array)");
