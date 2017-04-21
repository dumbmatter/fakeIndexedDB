const assert = require("assert");

// Because of https://github.com/babel/babel/issues/3815 and http://stackoverflow.com/a/33877501/786644 we can't check
// the error class unless we sacrifice Node 4 support.
const nativeAssertThrows = assert.throws;
assert.throws = (func, err) => {
    nativeAssertThrows(func);
};
