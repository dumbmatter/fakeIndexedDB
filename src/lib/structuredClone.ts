// Built-in structuredClone arrived in Node 17, so we need to keep this file around as long as we support Node 16

// @ts-expect-error
import realisticStructuredClone from "realistic-structured-clone";
import { DataCloneError } from "./errors.js";

const structuredCloneWrapper = <T>(input: T): T => {
    if (typeof structuredClone !== "undefined") {
        return structuredClone(input);
    }

    try {
        return realisticStructuredClone(input);
    } catch (err) {
        throw new DataCloneError();
    }
};

export default structuredCloneWrapper;
