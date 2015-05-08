/**
 * Created by Kristof on 10/03/2015.
 */

QUnit.module("Objectstore - Put");
QUnit.test("Putting data", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test" };

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    equal(ex.name, "DataError", "DataError");
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
            assert.ok(false, "Database exception");
            done();
        };
    }, done, assert);
    });
QUnit.test("Putting data with external key", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test" };
    var key = 1;

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, key, "Key ok");
                    };
                    putRequest.onerror = function (e){
                        ok(false, "put error");
                    };
                }
                catch (ex){
                    ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data - objectstore autoincrement", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test" };
    initionalSituationObjectStoreWithAutoIncrement(function () {
		var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                    };
                    putRequest.onerror = function (e){
                        ok(false, "put error");
                    };
                }
                catch (ex){
                    ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with external key - objectstore autoincrement", function (assert) {
    var done = assert.async();
    assert.expect(2);
	var data = { test: "test" };
	var key = 1;
	initionalSituationObjectStoreWithAutoIncrement(function () {
		var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, key, "Key ok");
                    };
                    putRequest.onerror = function (e){
                        ok(false, "put error");
                    };
                }
                catch (ex){
                    ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with external key (increase autoincrement) - objectstore autoincrement", function (assert) {
    var done = assert.async();
    assert.expect(3);
	var data = { test: "test" };
	initionalSituationObjectStoreWithAutoIncrement(function () {
		var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        var key = e.target.result;
						
						try{
							var putRequest2 = objectstore.put(data, (key + 3));

							putRequest2.onsuccess = function (e){
								equal(e.target.result, (key + 3), "Key same as provided");
                                try{
                                    var putRequest3 = objectstore.put(data);

                                    putRequest3.onsuccess = function (e){
                                        equal(e.target.result, (key + 4), "Key increased after put with provided key");
                                    };
                                    putRequest3.onerror = function (e){
                                        ok(false, "put error");
                                    };
                                }
                                catch (ex){
                                    ok(false, "put exception");
                                }
							};
							putRequest2.onerror = function (e){
								ok(false, "put error");
							};
						}
						catch (ex){
							ok(false, "put exception");
						}
                    };
                    putRequest.onerror = function (e){
                        ok(false, "put error");
                    };
                }
                catch (ex){
                    ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data - objectstore keyPath", function (assert) {
    var done = assert.async();
    assert.expect(1);
	var data = { test: "test" };
	initionalSituationObjectStoreWithKeyPathNoAutoIncrement(function () {
		var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    equal(ex.name, "DataError", "DataError");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with inline key - objectstore keyPath", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test", id: 1 };
    initionalSituationObjectStoreWithKeyPathNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, data.id, "Key same as provided");
                    };
                    putRequest.onerror = function (e){
                    assert.ok(false, "put error");
                    };
                }
                catch (ex){
                    assert.ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with external key - objectstore keyPath", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test" };
    var key = 1;
    initionalSituationObjectStoreWithKeyPathNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Transaction exception");
                    };
                }
                catch (ex){
                    equal(ex.name, "DataError", "DataError");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data - objectstore keyPath autoincrement", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test" };
    initionalSituationObjectStoreWithKeyPathAndAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, 1, "Key same as provided");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "put error");   
                    };
                }
                catch (ex){
                    assert.ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with inline key - objectstore keyPath autoincrement", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test", id:2 };
    initionalSituationObjectStoreWithKeyPathAndAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, data.id, "Key set by autoincrement");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "put error");   
                    };
                }
                catch (ex){
                    assert.ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with external key - objectstore keyPath autoincrement", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test" };
    var key = 1;
    initionalSituationObjectStoreWithKeyPathAndAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    equal(ex.name, "DataError", "DataError");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    assert.ok(false, "Transaction abort");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with existing external key", function (assert) {
    var done = assert.async();
    assert.expect(2);

    initionalSituationObjectStoreNoAutoIncrementWithData(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(addData, addData.id);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, addData.id, "Key ok");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with existing internal key", function (assert) {
    var done = assert.async();
    assert.expect(2);

    initionalSituationObjectStoreWithKeyPathAndDataNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(addData);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, addData.id, "Key ok");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    assert.ok(false, "Put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
                e.target.result.close();
                done();
            }
        };
        request.onerror = function(){
            assert.ok(false, "Database error");
            done();
        };
    });
    });
QUnit.test("Putting data with invalid key", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test" };

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, data);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    equal(ex.name, "DataError", "DataError");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    assert.ok(false, "Transaction abort");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with external key - string", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test" };
    var key = "key";

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, key, "Key ok");
                    };
                    putRequest.onerror = function (e){
                        ok(false, "put error");
                    };
                }
                catch (ex){
                    ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with external key - array", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test" };
    var key = [1,2,3];

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        deepEqual(e.target.result, key, "Key ok");
                    };
                    putRequest.onerror = function (e){
                        ok(false, "put error");
                    };
                }
                catch (ex){
                    ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with inline key - string", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test", id: "key" };
    initionalSituationObjectStoreWithKeyPathNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        equal(e.target.result, data.id, "Key same as provided");
                    };
                    putRequest.onerror = function (e){
                    assert.ok(false, "put error");
                    };
                }
                catch (ex){
                    assert.ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with inline key - date", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test", id: new Date() };
    initionalSituationObjectStoreWithKeyPathNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        deepEqual(e.target.result, data.id, "Key same as provided");
                    };
                    putRequest.onerror = function (e){
                    assert.ok(false, "put error");
                    };
                }
                catch (ex){
                    assert.ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with inline key - array", function (assert) {
    var done = assert.async();
    assert.expect(2);
    var data = { test: "test", id: [1,2,3] };
    initionalSituationObjectStoreWithKeyPathNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data);

                    putRequest.onsuccess = function (e){
                        ok(true, "data putted");
                        deepEqual(e.target.result, data.id, "Key same as provided");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "put error");
                    };
                }
                catch (ex){
                    assert.ok(false, "put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(false, "Transaction aborted");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data - ReadOnly transaction", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test" };
    var key = "key";

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readonly");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    equal(ex.name, "ReadOnlyError", "ReadOnlyError");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    assert.ok(false, "Transaction abort");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data - DataCloneError", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var data = { test: "test", toString: function () {
                                            return true;
                                        }
                };
    var key = "key";

    initionalSituationObjectStoreNoAutoIncrement(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(data, key);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        assert.ok(false, "Put error");
                    };
                }
                catch (ex){
                    equal(ex.name, "DataCloneError", "DataCloneError");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    assert.ok(false, "Transaction abort");
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
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with existing index key - unique index ", function (assert) {
    var done = assert.async();
    assert.expect(3);

    initionalSituationIndexUniqueIndexWithData(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(addData, addData.id + 1);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        equal(e.target.error.name, "ConstraintError", "ConstraintError");
                    };
                }
                catch (ex){
                    assert.ok(false, "Put exception");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.target.error.name, "ConstraintError", "ConstraintError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (err){
                    equal(err.target.error.name, "ConstraintError", "ConstraintError");
                    //e.target.result.close();
                    //done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction exception");
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
QUnit.test("Putting data with existing index key - unique multientry index ", function (assert) {
    var done = assert.async();
    assert.expect(3);

    initionalSituationIndexUniqueMultiEntryIndexWithData(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], "readwrite");
                var objectstore = transaction.objectStore(objectStoreName);

                try{
                    var putRequest = objectstore.put(addData, addData.id + 1);

                    putRequest.onsuccess = function (e){
                        ok(false, "data putted");
                    };
                    putRequest.onerror = function (e){
                        equal(e.target.error.name, "ConstraintError", "ConstraintError");
                    };
                }
                catch (ex){
                    equal(ex.name, "ConstraintError", "ConstraintError");
                }

                transaction.oncomplete = function (e){
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (err){
                    equal(err.target.error.name, "ConstraintError", "ConstraintError");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (err){
                    equal(err.target.error.name, "ConstraintError", "ConstraintError");
                    //e.target.result.close();
                    //done();
                };
            }
            catch (ex) {
                assert.ok(false, "Transaction exception");
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
// TODO: test adding data to a deleted objectstore