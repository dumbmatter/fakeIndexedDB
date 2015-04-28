var assert = require('assert');
var FDBOpenDBRequest = require('../../lib/FDBOpenDBRequest');
var FDBTransaction = require('../../lib/FDBTransaction');
var InvalidStateError = require('../../lib/errors/InvalidStateError');
var support = require('./support');
var createdb = support.createdb;

describe('W3C IDBObjectStore Tests', function () {
    // idbobjectstore_deleted
    it('Attempting to use deleted IDBObjectStore', function (done) {
        var db,
          add_success = false

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            var objStore = db.createObjectStore("store", { autoIncrement: true });
            assert.equal(db.objectStoreNames[0], "store", "objectStoreNames");

            var rq_add = objStore.add(1);
            rq_add.onsuccess = function() { add_success = true; };
            rq_add.onerror = function () { throw new Error('rq_add.error') };

            objStore.createIndex("idx", "a");
            db.deleteObjectStore("store");
            assert.equal(db.objectStoreNames.length, 0, "objectStoreNames.length after delete");

            assert.throws(function() { objStore.add(2); }, InvalidStateError);
            assert.throws(function() { objStore.put(3); }, InvalidStateError);
            assert.throws(function() { objStore.get(1); }, InvalidStateError);
            assert.throws(function() { objStore.clear(); }, InvalidStateError);
            assert.throws(function() { objStore.count(); }, InvalidStateError);
            assert.throws(function() { objStore.delete(1); }, InvalidStateError);
            assert.throws(function() { objStore.openCursor(); }, InvalidStateError);
            assert.throws(function() { objStore.index("idx"); }, InvalidStateError);
            assert.throws(function() { objStore.deleteIndex("idx"); }, InvalidStateError);
            assert.throws(function() { objStore.createIndex("idx2", "a"); }, InvalidStateError);
        }

        open_rq.onsuccess = function() {
            assert(add_success, "First add was successful");
            done();
        }
    });
});
