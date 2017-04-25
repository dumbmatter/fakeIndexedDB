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


'use strict';

promise_test(t => {
  return createDatabase(t, database => {
    createBooksStore(t, database);
  }).then(database => {
    database.close();
  }).then(() => migrateDatabase(t, 2, (database, transaction, request) => {
    transaction.abort();
    assert_equals(
        request.transaction, transaction,
        "The open request's transaction should be reset after onabort");

    assert_throws(
        'TransactionInactiveError',
        () => { database.createObjectStore('books2'); },
        'createObjectStore exception should reflect that the transaction is ' +
        'still running');
    assert_throws(
        'TransactionInactiveError',
        () => { database.deleteObjectStore('books'); },
        'deleteObjectStore exception should reflect that the transaction is' +
        'still running');
  }));
}, 'synchronously after abort() is called');

promise_test(t => {
  return createDatabase(t, database => {
    createBooksStore(t, database);
  }).then(database => {
    database.close();
  }).then(() => migrateDatabase(t, 2, (database, transaction, request) => {
    let abortFired = false;
    const abortPromise = new Promise((resolve, reject) => {
      transaction.addEventListener('abort', () => {
        abortFired = true;
        resolve();
      }, false);
      transaction.abort();
    });

    return Promise.resolve().then(() => {
      assert_false(
          abortFired,
          'The abort event should fire after promises are resolved');
      assert_equals(
          request.transaction, transaction,
          "The open request's transaction should be reset after onabort");
      assert_throws(
          'TransactionInactiveError',
          () => { database.createObjectStore('books2'); },
          'createObjectStore exception should reflect that the transaction ' +
          'is still running');
      assert_throws(
          'TransactionInactiveError',
          () => { database.deleteObjectStore('books'); },
          'deleteObjectStore exception should reflect that the transaction ' +
          'is still running');
    }).then(() => abortPromise);
  }));
}, 'in a promise microtask after abort() is called, before the transaction ' +
   'abort event is fired');

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
      transaction.abort();
    });
  }));
}, 'in the abort event handler for a transaction aborted due to an abort() ' +
   'call');

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
      transaction.abort();
    });
  }));
}, 'in a setTimeout(0) callback after the abort event is fired for a ' +
   'transaction aborted due to an abort() call');

