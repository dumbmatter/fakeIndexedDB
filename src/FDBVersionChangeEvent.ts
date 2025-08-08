import FakeEvent from "./lib/FakeEvent.js";

class FDBVersionChangeEvent extends FakeEvent {
    public newVersion: number | null;
    public oldVersion: number;

    constructor(
        type: "blocked" | "success" | "upgradeneeded" | "versionchange",
        parameters: { newVersion?: number | null; oldVersion?: number } = {},
    ) {
        super(type);

        this.newVersion =
            parameters.newVersion !== undefined ? parameters.newVersion : null;
        this.oldVersion =
            parameters.oldVersion !== undefined ? parameters.oldVersion : 0;
    }

    get [Symbol.toStringTag]() {
        return "IDBVersionChangeEvent";
    }
}

export default FDBVersionChangeEvent;
