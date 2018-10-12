const realisticStructuredClone = require("realistic-structured-clone"); // tslint:disable-line no-var-requires
import { DataCloneError } from "./errors";

const structuredClone = <T>(input: T): T => {
    try {
        return realisticStructuredClone(input);
    } catch (err) {
        throw new DataCloneError();
    }
};

export default structuredClone;
