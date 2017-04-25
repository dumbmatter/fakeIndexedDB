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
    test,
} = require("../support-node");

const document = {};
const window = global;


'use strict';

promise_test(testCase => {
    let store = null, migrationTransaction = null, migrationDatabase = null;
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
    }).then(database => {
        database.close();
    }).then(() => migrateDatabase(testCase, 2, (database, transaction) => {
        store = createNotBooksStore(testCase, database);
        migrationDatabase = database;
        migrationTransaction = transaction;
        assert_array_equals(
            database.objectStoreNames, ['books', 'not_books'],
            'IDBDatabase.objectStoreNames should include a newly created ' +
            'store before the transaction is aborted');
        assert_array_equals(
            transaction.objectStoreNames, ['books', 'not_books'],
            'IDBTransaction.objectStoreNames should include a newly created ' +
            'store before the transaction is aborted');

        transaction.abort();
        assert_throws(
            'InvalidStateError', () => store.get('query'),
            'IDBObjectStore.get should throw InvalidStateError, indicating ' +
            'that the store is marked for deletion, immediately after ' +
            'IDBTransaction.abort() returns');
        assert_array_equals(
            transaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should stop including the newly ' +
            'created store immediately after IDBTransaction.abort() returns');
        assert_array_equals(
            database.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should stop including the newly ' +
            'created store immediately after IDBTransaction.abort() returns');
    })).then(() => {
        assert_throws(
            'InvalidStateError', () => store.get('query'),
            'IDBObjectStore.get should throw InvalidStateError, indicating ' +
            'that the store is marked for deletion, after the transaction is ' +
            'aborted');
        assert_array_equals(
            migrationDatabase.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should stop including the newly ' +
            'created store after the transaction is aborted');
        assert_array_equals(
            migrationTransaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should stop including the newly ' +
            'created store after the transaction is aborted');
    });
}, 'Created stores get marked as deleted after their transaction aborts');

promise_test(testCase => {
    let store = null, migrationTransaction = null, migrationDatabase = null;
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
        createNotBooksStore(testCase, database);
    }).then(database => {
        database.close();
    }).then(() => migrateDatabase(testCase, 2, (database, transaction) => {
        migrationDatabase = database;
        migrationTransaction = transaction;
        store = transaction.objectStore('not_books');

        database.deleteObjectStore('not_books');
        assert_throws(
            'InvalidStateError', () => store.get('query'),
            'IDBObjectStore.get should throw InvalidStateError, indicating ' +
            'that the store is marked for deletion, immediately after ' +
            'IDBDatabase.deleteObjectStore() returns');
        assert_array_equals(
            transaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should stop including the ' +
            'deleted store immediately after IDBDatabase.deleteObjectStore() ' +
            'returns');
        assert_array_equals(
            database.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should stop including the newly ' +
            'created store immediately after IDBDatabase.deleteObjectStore() ' +
            'returns');

        transaction.abort();
        assert_throws(
            'TransactionInactiveError', () => store.get('query'),
            'IDBObjectStore.get should throw TransactionInactiveError, ' +
            'indicating that the store is no longer marked for deletion, ' +
            'immediately after IDBTransaction.abort() returns');
        assert_array_equals(
            database.objectStoreNames, ['books', 'not_books'],
            'IDBDatabase.objectStoreNames should include the deleted store ' +
            'store immediately after IDBTransaction.abort() returns');
        assert_array_equals(
            transaction.objectStoreNames, ['books', 'not_books'],
            'IDBTransaction.objectStoreNames should include the deleted ' +
            'store immediately after IDBTransaction.abort() returns');
    })).then(() => {
        assert_throws(
            'TransactionInactiveError', () => store.get('query'),
            'IDBObjectStore.get should throw TransactionInactiveError, ' +
            'indicating that the store is no longer marked for deletion, ' +
            'after the transaction is aborted');
        assert_array_equals(
            migrationDatabase.objectStoreNames, ['books', 'not_books'],
            'IDBDatabase.objectStoreNames should include the previously ' +
            'deleted store after the transaction is aborted');
        assert_array_equals(
            migrationTransaction.objectStoreNames, ['books', 'not_books'],
            'IDBTransaction.objectStoreNames should include the previously ' +
            'deleted store after the transaction is aborted');
    });
}, 'Deleted stores get marked as not-deleted after the transaction aborts');

promise_test(testCase => {
    let store = null, migrationTransaction = null, migrationDatabase = null;
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
    }).then(database => {
        database.close();
    }).then(() => migrateDatabase(testCase, 2, (database, transaction) => {
        store = createNotBooksStore(testCase, database);
        migrationDatabase = database;
        migrationTransaction = transaction;
        assert_array_equals(
            database.objectStoreNames, ['books', 'not_books'],
            'IDBDatabase.objectStoreNames should include a newly created ' +
            'store before the transaction is aborted');
        assert_array_equals(
            transaction.objectStoreNames, ['books', 'not_books'],
            'IDBTransaction.objectStoreNames should include a newly created ' +
            'store before the transaction is aborted');

        database.deleteObjectStore('not_books');
        assert_throws(
            'InvalidStateError', () => store.get('query'),
            'IDBObjectStore.get should throw InvalidStateError, indicating ' +
            'that the store is marked for deletion, immediately after ' +
            'IDBDatabase.deleteObjectStore() returns');
        assert_array_equals(
            transaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should stop including the ' +
            'deleted store immediately after IDBDatabase.deleteObjectStore() ' +
            'returns');
        assert_array_equals(
            database.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should stop including the newly ' +
            'created store immediately after IDBDatabase.deleteObjectStore() ' +
            'returns');

        transaction.abort();
        assert_throws(
            'InvalidStateError', () => store.get('query'),
            'IDBObjectStore.get should throw InvalidStateError, indicating ' +
            'that the store is still marked for deletion, immediately after ' +
            'IDBTransaction.abort() returns');
        assert_array_equals(
            transaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should not include the newly ' +
            'created store immediately after IDBTransaction.abort() returns');
        assert_array_equals(
            database.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should not include the newly ' +
            'created store immediately after IDBTransaction.abort() returns');
    })).then(() => {
        assert_throws(
            'InvalidStateError', () => store.get('query'),
            'IDBObjectStore.get should throw InvalidStateError, indicating ' +
            'that the store is still marked for deletion, after the ' +
            'transaction is aborted');
        assert_array_equals(
            migrationDatabase.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should not include the newly ' +
            'created store after the transaction is aborted');
        assert_array_equals(
            migrationTransaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should not include the newly ' +
            'created store after the transaction is aborted');
    });
}, 'Created+deleted stores are still marked as deleted after their ' +
    'transaction aborts');

promise_test(testCase => {
    let migrationTransaction = null, migrationDatabase = null;
    return createDatabase(testCase, (database, transaction) => {
        createBooksStore(testCase, database);
        createNotBooksStore(testCase, database);
    }).then(database => {
        database.close();
    }).then(() => migrateDatabase(testCase, 2, (database, transaction) => {
        migrationDatabase = database;
        migrationTransaction = transaction;

        database.deleteObjectStore('not_books');
        assert_array_equals(
            transaction.objectStoreNames, ['books'],
            'IDBTransaction.objectStoreNames should stop including the ' +
            'deleted store immediately after IDBDatabase.deleteObjectStore() ' +
            'returns');
        assert_array_equals(
            database.objectStoreNames, ['books'],
            'IDBDatabase.objectStoreNames should stop including the newly ' +
            'created store immediately after IDBDatabase.deleteObjectStore() ' +
            'returns');

        transaction.abort();
        assert_array_equals(
            database.objectStoreNames, ['books', 'not_books'],
            'IDBDatabase.objectStoreNames should include the deleted store ' +
            'store immediately after IDBTransaction.abort() returns');
        assert_array_equals(
            transaction.objectStoreNames, ['books', 'not_books'],
            'IDBTransaction.objectStoreNames should include the deleted ' +
            'store immediately after IDBTransaction.abort() returns');
    })).then(() => {
        assert_array_equals(
            migrationDatabase.objectStoreNames, ['books', 'not_books'],
            'IDBDatabase.objectStoreNames should include the previously ' +
            'deleted store after the transaction is aborted');
        assert_array_equals(
            migrationTransaction.objectStoreNames, ['books', 'not_books'],
            'IDBTransaction.objectStoreNames should include the previously ' +
            'deleted store after the transaction is aborted');
    });
}, 'Un-instantiated deleted stores get marked as not-deleted after the ' +
   'transaction aborts');

