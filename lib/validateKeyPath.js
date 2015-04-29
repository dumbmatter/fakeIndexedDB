'use strict';

var CharFunk = require('charfunk');

// http://www.w3.org/TR/IndexedDB/#dfn-valid-key-path
function validateKeyPath(keyPath, parent) {
    // This doesn't make sense to me based on the spec, but it is needed to pass the W3C KeyPath tests (see same comment in extractKey)
    if (keyPath !== undefined && keyPath !== null && typeof keyPath !== 'string' && keyPath.toString && (parent === 'array' || !Array.isArray(keyPath))) {
        keyPath = keyPath.toString();
    }

    if (typeof keyPath === 'string') {
        if (keyPath === '' && parent !== 'string') {
            return;
        }
        try {
            if (keyPath.length >= 1 && CharFunk.isValidName(keyPath)) {
                return;
            }
        } catch (err) {
            throw new SyntaxError(err.message);
        }
        if (keyPath.indexOf(' ') >= 0) {
            throw new SyntaxError();
        }
    }

    if (Array.isArray(keyPath) && keyPath.length > 0) {
        if (parent) {
            // No nested arrays
            throw new SyntaxError();
        }
        keyPath.forEach(function (part) {
            validateKeyPath(part, 'array');
        });
        return;
    } else if (typeof keyPath === 'string' && keyPath.indexOf('.') >= 0) {
        keyPath = keyPath.split('.');
        keyPath.forEach(function (part) {
            validateKeyPath(part, 'string');
        });
        return;
    }

    throw new SyntaxError();
}

module.exports = validateKeyPath;