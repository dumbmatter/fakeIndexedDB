class FakeDOMStringList extends Array<string> {
    contains = (value: string) => {
        for (const value2 of this) {
            if (value === value2) {
                return true;
            }
        }
        return false;
    }

    item = (i: number) => {
        if (i < 0 || i >= this.length) {
            return null;
        }
        return this[i];
    }

    // Used internally, should not be used by others. I could maybe get rid of these and replace rather than mutate, but too lazy to check the spec.
    _push = (...values: Parameters<typeof Array.prototype.push>) => {
        return Array.prototype.push.call(this, ...values);
    }
    _sort = (...values: Parameters<typeof Array.prototype.sort>) => {
        return Array.prototype.sort.call(this, ...values);
    }
}

// Would be nice to remove these properties to fix https://github.com/dumbmatter/fakeIndexedDB/issues/66 but for some reason it breaks Dexie - see test/dexie.js and FakeDOMStringList tests
/*
// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array
const arrayPropertiesToDelete = ["from", "isArray", "of"];
const arrayMethodsToDelete = [
    "at",
    "concat",
    "copyWithin",
    "entries",
    "every",
    "fill",
    "filter",
    "find",
    "findIndex",
    "flat",
    "flatMap",
    "forEach",
    "includes",
    "indexOf",
    "join",
    "keys",
    "lastIndexOf",
    "map",
    "pop",
    "push",
    "reduce",
    "reduceRight",
    "reverse",
    "shift",
    "slice",
    "some",
    "sort",
    "splice",
    "unshift",
    "values",
];

// Set to undefined rather than delete, so it doesn't go up the chain to Array. Not perfect, but good enough?
for (const property of arrayPropertiesToDelete) {
    (FakeDOMStringList as any)[property] = undefined;
}
for (const property of arrayMethodsToDelete) {
    (FakeDOMStringList as any).prototype[property] = undefined;
}
*/

export default FakeDOMStringList;
