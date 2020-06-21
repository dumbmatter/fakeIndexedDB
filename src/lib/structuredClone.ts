const realisticStructuredClone = require("realistic-structured-clone"); // tslint:disable-line no-var-requires
import { newDataCloneError } from "./errors";

const structuredClone = <T>(input: T): T => {
    try {
        return realisticStructuredClone(input);
    } catch (err) {
        throw newDataCloneError();
    }
};

export default structuredClone;
