// @ts-ignore
import realisticStructuredClone from "realistic-structured-clone";
import { DataCloneError } from "./errors";

const structuredClone = <T>(input: T): T => {
    try {
        return realisticStructuredClone(input);
    } catch (err) {
        throw new DataCloneError();
    }
};

export default structuredClone;
