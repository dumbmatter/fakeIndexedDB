/**
 * Created by Kristof on 17/02/2015.
 */
var indexedDb = getParameterByName('imp') ? window.indexedDB : window.indexedDBmock;
var KeyRange = getParameterByName('imp') ? window.IDBKeyRange : window.IDBKeyRangemock;
var dbName = "TestDatabase";
var objectStoreName = "objectStore";
var anOtherObjectStoreName = "anOtherObjectStoreName";
var indexProperty = "name";
var indexPropertyMultiEntry = "multiEntry";
var addData = { test: "addData", name: "name", id: 1, multiEntry: [1, "test", new Date()] };
var addData2 = { test: "addData2", name: "name2", id: 2 };
var addData3 = { test: "addData3", name: "name3", id: 3 };
var addData4 = { test: "addData4", name: "name4", id: 4 };
var addData5 = { test: "addData5", name: "name5", id: 5 };
var addData6 = { test: "addData6", name: "name6", id: 6 };
var addData7 = { test: "addData7", name: "name7", id: 7 };
var addData8 = { test: "addData8", name: "name8", id: 8 };
var addData9 = { test: "addData9", name: "name9", id: 9 };
var addData10 = { test: "addData10", name: "name10", id: 10 };
var msgCreatingInitialSituationFailed = "Creating initial situation failed";

function initionalSituation(callBack, done, assert) {
    var request = indexedDb.deleteDatabase(dbName);

    request.onsuccess = function(){
        callBack();
    };
    request.onerror = function(){
        assert.ok(false, msgCreatingInitialSituationFailed);
        done();
    };
}
function initionalSituationDatabase(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
    }, done, assert);
}
function initionalSituationDatabaseVersion(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName, 2);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
    }, done, assert);
}
function initionalSituationObjectStore(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function(e){
            if (e.type == "upgradeneeded") {
                try {
                    e.target.transaction.db.createObjectStore(objectStoreName);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    }, done, assert);
}
function initionalSituation2ObjectStore(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function(e){
            if (e.type == "upgradeneeded") {
                try {
                    e.target.transaction.db.createObjectStore(objectStoreName);
                    e.target.transaction.db.createObjectStore(anOtherObjectStoreName);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    }, done, assert);
}
function initionalSituationObjectStoreNoAutoIncrement(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    e.target.transaction.db.createObjectStore(objectStoreName, {autoIncrement: false});
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreWithAutoIncrement(callBack, done, assert) {
    initionalSituation(function () {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    e.target.transaction.db.createObjectStore(objectStoreName, { autoIncrement: true });
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreWithKeyPathNoAutoIncrement(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    e.target.transaction.db.createObjectStore(objectStoreName, {keyPath: "id", autoIncrement: false});
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreWithKeyPathAndAutoIncrement(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    e.target.transaction.db.createObjectStore(objectStoreName, {keyPath: "id", autoIncrement: true});
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreNoAutoIncrementWithData(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName, { autoIncrement: false });
                    objectstore.add(addData, addData.id);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreWithKeyPathAndData(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName, { autoIncrement: false, keyPath: "id" });
                    objectstore.add(addData);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreWithKeyPathAndDataNoAutoIncrement(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName, {keyPath: "id", autoIncrement: false});
                    objectstore.add(addData);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationObjectStoreWithKeyPathAndMultipleDataNoAutoIncrement(callBack, done, assert) {
    initionalSituation(function() {
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function (e) {
            e.target.result.close();
            callBack();
        };
        request.onerror = function () {
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function (e) {
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName, {keyPath: "id", autoIncrement: false});
                    objectstore.add(addData);
                    objectstore.add(addData2);
                    objectstore.add(addData3);
                    objectstore.add(addData4);
                    objectstore.add(addData5);
                    objectstore.add(addData6);
                    objectstore.add(addData7);
                    objectstore.add(addData8);
                    objectstore.add(addData9);
                    objectstore.add(addData10);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    });
}
function initionalSituationIndex(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function(e){
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName);
                    objectstore.createIndex(indexProperty, indexProperty);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    }, done, assert);
}
function initionalSituationIndexUniqueIndexWithData(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function(e){
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName);
                    objectstore.createIndex(indexProperty, indexProperty, { unique: true });
                    objectstore.add(addData, addData.id);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    }, done, assert);
}
function initionalSituationIndexUniqueMultiEntryIndexWithData(callBack, done, assert) {
    initionalSituation(function(){
        var request = indexedDb.open(dbName, 1);
        request.onsuccess = function(e){
            e.target.result.close();
            callBack();
        };
        request.onerror = function(){
            assert.ok(false, msgCreatingInitialSituationFailed);
            done();
        };
        request.onupgradeneeded = function(e){
            if (e.type == "upgradeneeded") {
                try {
                    var objectstore = e.target.transaction.db.createObjectStore(objectStoreName);
                    objectstore.createIndex(indexPropertyMultiEntry, indexPropertyMultiEntry, { unique: true, multiEntry: true });
                    objectstore.add(addData, addData.id);
                }
                catch (ex) {
                    assert.ok(false, msgCreatingInitialSituationFailed);
                    done();
                }
            }
        };
    }, done, assert);
}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\[").replace(/[\]]/, "\\]");
    var regex = new RegExp("[\\?&]" + name + "=([^&#]*)"),
        results = regex.exec(location.search);
    return results === null ? "" : decodeURIComponent(results[1].replace(/\+/g, " "));
}