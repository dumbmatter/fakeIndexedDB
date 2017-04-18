// Polyfill the DOMStringList methods on array, for objectStoreNames and indexNames
const addDomStringListMethods = (array) => {
    Object.defineProperty(array, 'item', {
        value: function (i) {
            return this[i];
        }
    });

    Object.defineProperty(array, 'contains', {
        value: function (value) {
            return this.indexOf(value) >= 0;
        }
    });
}

module.exports = addDomStringListMethods;
