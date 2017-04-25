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


'use strict';

promise_test(t => {
  return createDatabase(t, database => {
    createBooksStore(t, database);
  }).then(database => {
    database.close();
  }).then(() => migrateDatabase(t, 2, (database, transaction, request) => {
    return new Promise((resolve, reject) => {
      transaction.addEventListener('abort', () => {
        resolve(new Promise((resolve, reject) => {
          assert_equals(
              request.transaction, transaction,
              "The open request's transaction should be reset after onabort");
          assert_throws(
              'InvalidStateError',
              () => { database.createObjectStore('books2'); },
              'createObjectStore exception should reflect that the ' +
              'transaction is no longer running');
          assert_throws(
              'InvalidStateError',
              () => { database.deleteObjectStore('books'); },
              'deleteObjectStore exception should reflect that the ' +
              'transaction is no longer running');
          resolve();
        }));
      }, false);
      transaction.objectStore('books').add(BOOKS_RECORD_DATA[0]);
      transaction._willBeAborted();
    });
  }));
}, 'in the abort event handler for a transaction aborted due to an unhandled ' +
   'request error');

promise_test(t => {
  return createDatabase(t, database => {
    createBooksStore(t, database);
  }).then(database => {
    database.close();
  }).then(() => migrateDatabase(t, 2, (database, transaction, request) => {
    return new Promise((resolve, reject) => {
      transaction.addEventListener('abort', () => {
        setTimeout(() => {
          resolve(new Promise((resolve, reject) => {
            assert_equals(
                request.transaction, null,
                "The open request's transaction should be reset after " +
                'onabort microtasks');
            assert_throws(
                'InvalidStateError',
                () => { database.createObjectStore('books2'); },
                'createObjectStore exception should reflect that the ' +
                'transaction is no longer running');
            assert_throws(
                'InvalidStateError',
                () => { database.deleteObjectStore('books'); },
                'deleteObjectStore exception should reflect that the ' +
                'transaction is no longer running');
            resolve();
          }));
        }, 0);
      }, false);
      transaction.objectStore('books').add(BOOKS_RECORD_DATA[0]);
      transaction._willBeAborted();
    });
  }));
}, 'in a setTimeout(0) callback after the abort event is fired for a ' +
   'transaction aborted due to an unhandled request failure');

