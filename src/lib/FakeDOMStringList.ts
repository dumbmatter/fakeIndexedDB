class FakeDOMStringList implements DOMStringList {
    private _values: string[];

    constructor(...values: string[]) {
        this._values = values;

        for (let i = 0; i < values.length; i++) {
            this[i] = values[i];
        }
    }

    contains(value: string) {
        return this._values.includes(value);
    }

    item(i: number) {
        if (i < 0 || i >= this._values.length) {
            return null;
        }
        return this._values[i];
    }

    get length() {
        return this._values.length;
    }

    [Symbol.iterator]() {
        return this._values[Symbol.iterator]();
    }

    // Handled by proxy
    [index: number]: string;

    // Used internally, should not be used by others. I could maybe get rid of these and replace rather than mutate, but too lazy to check the spec.
    _push(...values: Parameters<typeof Array.prototype.push>) {
        for (let i = 0; i < values.length; i++) {
            this[this._values.length + i] = values[i];
        }

        this._values.push(...values);
    }
    _sort(...values: Parameters<typeof Array.prototype.sort>) {
        this._values.sort(...values);

        for (let i = 0; i < this._values.length; i++) {
            this[i] = this._values[i];
        }

        return this;
    }
}

export default FakeDOMStringList;
