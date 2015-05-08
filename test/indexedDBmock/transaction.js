/**
 * Created by Kristof on 10/03/2015.
 */

QUnit.module("Transaction");
QUnit.test("Opening transaction", function (assert) {
    var done = assert.async();
    assert.expect(3);

    initionalSituationObjectStore(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName]);
                assert.ok(true, "Transaction open");
                assert.equal(transaction.mode, "readonly", "readonly");

                transaction.oncomplete = function (e){
                    assert.ok(true, "Transaction commited");
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
QUnit.test("Opening readonly transaction", function (assert) {
    var done = assert.async();
    assert.expect(3);
    var mode = "readonly";

    initionalSituationObjectStore(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName]);
                assert.ok(true, "Transaction open");
                assert.equal(transaction.mode, mode, mode);

                transaction.oncomplete = function (e){
                    assert.ok(true, "Transaction commited");
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
QUnit.test("Opening readwrite transaction", function (assert) {
    var done = assert.async();
    assert.expect(3);
    var mode = "readwrite";

    initionalSituationObjectStore(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName], mode);
                assert.ok(true, "Transaction open");
                assert.equal(transaction.mode, mode, mode);

                transaction.oncomplete = function (e){
                    assert.ok(true, "Transaction commited");
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
QUnit.test("Aborting transaction", function (assert) {
    var done = assert.async();
    assert.expect(2);

    initionalSituationObjectStore(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([objectStoreName]);
                assert.ok(true, "Transaction open");

                transaction.oncomplete = function (e){
                    assert.ok(false, "Transaction commited");
                    e.target.db.close();
                    done();
                };
                transaction.onabort = function (){
                    assert.ok(true, "Transaction aborted");
                    e.target.result.close();
                    done();
                };
                transaction.onerror = function (){
                    assert.ok(false, "Transaction error");
                    e.target.result.close();
                    done();
                };
                transaction.abort();
            }
            catch (ex) {
                assert.equal(ex.type, "InvalidAccessError", transArgs.message);
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
QUnit.test("Opening transaction - without objectStore", function (assert) {
    var done = assert.async();
    assert.expect(1);

    initionalSituationObjectStore(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([]);
                assert.ok(false, "Transaction open");

                transaction.oncomplete = function (e){
                    assert.ok(false, "Transaction commited");
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
                assert.equal(ex.name, "InvalidAccessError", "InvalidAccessError");
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
QUnit.test("Opening transaction - non existing objectStore", function (assert) {
    var done = assert.async();
    assert.expect(1);
    var anOtherObjectStore = "anOtherObjectStore";
    initionalSituation(function () {
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            try{
                var transaction = e.target.result.transaction([anOtherObjectStore]);
                assert.ok(false, "Transaction open");

                transaction.oncomplete = function (e){
                    assert.ok(false, "Transaction commited");
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
                assert.equal(ex.name, "NotFoundError", "NotFoundError");
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
// TODO: Test concurrent transactions