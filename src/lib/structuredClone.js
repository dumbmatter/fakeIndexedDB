const realisticStructuredClone = require('realistic-structured-clone');
const {DataCloneError} = require('./errors');

const structuredClone = (input) => {
    try {
        return realisticStructuredClone(input);
    } catch (err) {
        throw new DataCloneError();
    }
};

module.exports = structuredClone;
