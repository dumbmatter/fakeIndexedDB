'use strict';

var traverse = require('traverse');
var DataError = require('./errors/DataError');

// http://www.w3.org/TR/IndexedDB/#dfn-valid-key
function validateKey(key, traversed) {
    if (typeof key === 'number') {
        if (isNaN(key)) {
            throw new DataError();
        }
    } else if (key instanceof Date) {
        if (isNaN(key.valueOf())) {
            throw new DataError();
        }
    } else if (Array.isArray(key)) {
        if (!traversed) {
            var seen = [];
            traverse(key).forEach(function (x) {
                if (seen.indexOf(x) >= 0) {
                    throw new DataError();
                }
                seen.push(x);
            });
        }

        var count = 0;
        key = key.map(function (item) {
            count += 1;
            return validateKey(item, true);
        });
        if (count !== key.length) {
            throw new DataError();
        }
        return key;
    } else if (typeof key !== 'string') {
        throw new DataError();
    }

    return key;
}

module.exports = validateKey;