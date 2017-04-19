const {ConstraintError} = require("./errors");

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

    public setIfLarger(num: number) {
        if (num > MAX_KEY) {
            throw new ConstraintError();
        }

        if (num > this.num) {
            this.num = Math.floor(num);
        }
    }
}

export default KeyGenerator;
