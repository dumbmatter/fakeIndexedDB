const realisticStructuredClone = require("realistic-structured-clone");
const {DataCloneError} = require("./errors");

const structuredClone = <T>(input: T): T => {
    try {
        return realisticStructuredClone(input);
    } catch (err) {
        throw new DataCloneError();
    }
};

export default structuredClone;
