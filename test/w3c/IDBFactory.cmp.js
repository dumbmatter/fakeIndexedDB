var assert = require('assert');
var fakeIndexedDB = require('../..');
var DataError = require('../../lib/errors/DataError');
var TypeError = require('../../lib/errors/TypeError');

describe('W3C IDBFactory.cmp Tests', function () {
    // idbfactory_cmp
    it("IDBFactory.cmp", function() {
        var greater = fakeIndexedDB.cmp(2, 1);
        var equal = fakeIndexedDB.cmp(2, 2);
        var less = fakeIndexedDB.cmp(1, 2);

        assert.equal(greater, 1, "greater");
        assert.equal(equal, 0, "equal");
        assert.equal(less, -1, "less");
    });

    // idbfactory_cmp2
    it("no argument", function() {
        assert.throws(function() {
            fakeIndexedDB.cmp();
        }, TypeError);
    });
    it("null", function() {
        assert.throws(function() {
            fakeIndexedDB.cmp(null, null);
        }, DataError);
        assert.throws(function() {
            fakeIndexedDB.cmp(1, null);
        }, DataError);
        assert.throws(function() {
            fakeIndexedDB.cmp(null, 1);
        }, DataError);
    });
    it("NaN", function() {
        assert.throws(function() {
            fakeIndexedDB.cmp(NaN, NaN);
        }, DataError);
        assert.throws(function() {
            fakeIndexedDB.cmp(1, NaN);
        }, DataError);
        assert.throws(function() {
            fakeIndexedDB.cmp(NaN, 1);
        }, DataError);
    });
});
