/**
 * Created by Kristof on 29/03/2015.
 */

QUnit.module("Objectstore - Get");
QUnit.test("Retrieving data - no data present for key", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var key = 1;

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(key);
                    getRequest.onsuccess = function (e){
                        equal(e.target.result, undefined, "Data undefined");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - external key", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreNoAutoIncrementWithData(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(addData.id);
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, addData, "Data undefined");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - internal key", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreWithKeyPathAndData(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(addData.id);
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, addData, "Data undefined");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - key range lowerBound exclusieve", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreWithKeyPathAndMultipleDataNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(KeyRange.lowerBound(5, true));
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, addData6, "Data");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - key range lowerBound inclusieve", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreWithKeyPathAndMultipleDataNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(KeyRange.lowerBound(5));
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, addData5, "Data");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - key range upperBound", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreWithKeyPathAndMultipleDataNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(KeyRange.upperBound(5));
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, addData, "No data Data");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - key range upperBound exclusieve", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreWithKeyPathAndMultipleDataNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(KeyRange.upperBound(1, true));
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, undefined, "No data Data");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
QUnit.test("Retrieving data - key range upperBound inclusieve", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStoreWithKeyPathAndMultipleDataNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var getRequest = objectstore.get(KeyRange.upperBound(1, false));
                    getRequest.onsuccess = function (e){
                        deepEqual(e.target.result, addData, "No data Data");
                    };
                    getRequest.onerror = function (e){
                        assert.ok(false, "Get error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Get error");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.error.name, "AbortError", "AbortError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction error");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    }, done, assert);
});
// TODO Add support for key ranges