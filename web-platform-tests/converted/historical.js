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
    promise_test,
    setup,
    step_timeout,
    test,
} = require("../support-node");

const document = {};
const window = global;


test(function() {
  // Replaced circa December 2011 by 'error'.
  assert_false('errorCode' in IDBRequest.prototype);
}, '"errorCode" should not be supported on IDBRequest.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBRequestReadyState enum).
  assert_false('LOADING' in IDBRequest);
}, '"LOADING" should not be supported on IDBRequest.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBRequestReadyState enum).
  assert_false('DONE' in IDBRequest);
}, '"DONE" should not be supported on IDBRequest.');

test(function() {
  // Replaced circa December 2011 by 'oldVersion'/'newVersion'.
  assert_false('version' in IDBVersionChangeEvent.prototype);
}, '"version" should not be supported on IDBVersionChangeEvent.');

test(function() {
  // Replaced circa December 2011 by open() with version.
  assert_false('setVersion' in IDBDatabase.prototype);
}, '"setVersion" should not be supported on IDBDatabase.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
  assert_false('NEXT' in IDBCursor);
}, '"NEXT" should not be supported on IDBCursor.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
  assert_false('NEXT_NO_DUPLICATE' in IDBCursor);
}, '"NEXT_NO_DUPLICATE" should not be supported on IDBCursor.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
  assert_false('PREV' in IDBCursor);
}, '"PREV" should not be supported on IDBCursor.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBCursorDirection enum).
  assert_false('PREV_NO_DUPLICATE' in IDBCursor);
}, '"PREV_NO_DUPLICATE" should not be supported on IDBCursor.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBTransactionMode enum).
  assert_false('READ_ONLY' in IDBTransaction);
}, '"READ_ONLY" should not be supported on IDBTransaction.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBTransactionMode enum).
  assert_false('READ_WRITE' in IDBTransaction);
}, '"READ_WRITE" should not be supported on IDBTransaction.');

test(function() {
  // Replaced circa May 2012 by a DOMString (later, IDBTransactionMode enum).
  assert_false('VERSION_CHANGE' in IDBTransaction);
}, '"VERSION_CHANGE" should not be supported on IDBTransaction.');
