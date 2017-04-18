const {ConstraintError} = require('./errors');

const MAX_KEY = 9007199254740992;

class KeyGenerator {
    constructor() {
// This is kind of wrong. Should start at 1 and increment only after record is saved
        this.num = 0;
    }

    next() {
        if (this.num >= MAX_KEY) {
            throw new ConstraintError();
        }

        this.num += 1;

        return this.num;
    }

    setIfLarger(num) {
        if (num > MAX_KEY) {
            throw new ConstraintError();
        }

        if (num > this.num) {
            this.num = Math.floor(num);
        }
    }
}

module.exports = KeyGenerator;
