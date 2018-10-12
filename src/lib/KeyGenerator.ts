import { ConstraintError } from "./errors";

const MAX_KEY = 9007199254740992;

class KeyGenerator {
    // This is kind of wrong. Should start at 1 and increment only after record is saved
    public num = 0;

    public next() {
        if (this.num >= MAX_KEY) {
            throw new ConstraintError();
        }

        this.num += 1;

        return this.num;
    }

    // https://w3c.github.io/IndexedDB/#possibly-update-the-key-generator
    public setIfLarger(num: number) {
        const value = Math.floor(Math.min(num, MAX_KEY)) - 1;

        if (value >= this.num) {
            this.num = value + 1;
        }
    }
}

export default KeyGenerator;
