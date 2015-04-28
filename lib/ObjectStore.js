'use strict';

var clone = require('structured-clone');
var FDBKeyRange = require('../lib/FDBKeyRange');
var KeyGenerator = require('./KeyGenerator');
var ConstraintError = require('./errors/ConstraintError');
var DataError = require('./errors/DataError');
var cmp = require('./cmp');
var extractKey = require('./extractKey');

// http://www.w3.org/TR/IndexedDB/#dfn-object-store
module.exports = function (rawDatabase, name, keyPath, autoIncrement) {
    this.rawDatabase = rawDatabase;
    this.records = [];
    this.rawIndexes = {};
    this.keyGenerator = autoIncrement === true ? new KeyGenerator() : null;
    this.deleted = false;

    this.name = name;
    this.keyPath = keyPath;
    this.autoIncrement = autoIncrement;

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-retrieving-a-value-from-an-object-store
    this.getValue = function (key) {
        var record;
        if (key instanceof FDBKeyRange) {
            record = this.records.find(function (record) {
                return FDBKeyRange.check(key, record.key);
            });
        } else {
            record = this.records.find(function (record) {
                return cmp(record.key, key) === 0;
            });
        }

        return record !== undefined ? clone(record.value) : undefined;
    };

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-storing-a-record-into-an-object-store
    this.storeRecord = function (newRecord, noOverwrite) {
        if (this.keyPath) {
            var key = extractKey(this.keyPath, newRecord.value);
            if (key !== undefined) {
                newRecord.key = key;
            }
        }

        var i;
        if (this.keyGenerator !== null && newRecord.key === undefined) {
            newRecord.key = this.keyGenerator.next();

            // Set in value if keyPath defiend but led to no key
            // http://www.w3.org/TR/IndexedDB/#dfn-steps-to-assign-a-key-to-a-value-using-a-key-path
            if (this.keyPath !== null) {
                var remainingKeyPath = this.keyPath;
                var object = newRecord.value;
                var identifier;

                i = 0; // Just to run the loop at least once
                while (i >= 0) {
                    if (typeof object !== 'object') {
                        throw new DataError();
                    }

                    i = remainingKeyPath.indexOf('.');
                    if (i >= 0) {
                        identifier = remainingKeyPath.slice(0, i);
                        remainingKeyPath = remainingKeyPath.slice(i + 1);

                        if (!object.hasOwnProperty(identifier)) {
                            object[identifier] = {};
                        }

                        object = object[identifier];
                    }
                }

                identifier = remainingKeyPath;

                object[identifier] = newRecord.key;
            }
        } else if (this.keyGenerator !== null && typeof newRecord.key === 'number') {
            this.keyGenerator.setIfLarger(newRecord.key);
        }

        i = this.records.findIndex(function (record) {
            return cmp(record.key, newRecord.key) === 0;
        });

        if (i >= 0) {
            if (noOverwrite) {
                throw new ConstraintError();
            } else {
                this.deleteRecord(newRecord.key);
            }
        }

        // Find where to put it so it's sorted by key
        if (this.records.length === 0) {
            i = 0;
        }
        i = this.records.findIndex(function (record) {
            return cmp(record.key, newRecord.key) === 1;
        });
        if (i === -1) {
            i = this.records.length;
        }
        this.records.splice(i, 0, newRecord);

        // Update indexes
        Object.keys(this.rawIndexes).forEach(function (name) {
            if (this.rawIndexes[name].initialized) {
                this.rawIndexes[name].storeRecord(newRecord);
            }
        }.bind(this));

        return newRecord.key;
    };

    // http://www.w3.org/TR/IndexedDB/#dfn-steps-for-deleting-records-from-an-object-store
    this.deleteRecord = function (key) {
// Needs to support key as range!

        var i = this.records.findIndex(function (record) {
            return cmp(record.key, key) === 0;
        });

        this.records.splice(i, 1);

// Needs to delete key in indexes too!
    };
};