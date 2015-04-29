'use strict';

var CharFunk = require('charfunk');

// http://www.w3.org/TR/IndexedDB/#dfn-valid-key-path
function validateKeyPath(keyPath, traversed) {
    if (typeof keyPath === 'string') {
        if (keyPath === '' && !traversed) {
            return;
        }
        try {
            if (CharFunk.isValidName(keyPath)) {
                return;
            }
        } catch (err) {
            throw new SyntaxError(err.message);
        }
        if (keyPath.indexOf(' ') >= 0) {
            throw new SyntaxError();
        }
    }

    if (Array.isArray(keyPath)) {
        if (traversed) {
            // No nested arrays
            throw new SyntaxError();
        }
    } else if (typeof keyPath === 'string' && keyPath.indexOf('.') >= 0) {
        keyPath = keyPath.split('.');
    }

    if (Array.isArray(keyPath)) {
        keyPath.forEach(function (part) {
            validateKeyPath(part, true);
        });
        return;
    }

    throw new SyntaxError();
}

module.exports = validateKeyPath;