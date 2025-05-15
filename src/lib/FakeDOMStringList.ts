const regex = /^\d+$/;
const isPositiveInteger = (prop: unknown): prop is string => {
    return typeof prop === "string" && regex.test(prop);
};

class FakeDOMStringList implements DOMStringList {
    private _values: string[];

    constructor(...values: string[]) {
        this._values = values;

        return new Proxy(this, {
            get(target, prop) {
                if (isPositiveInteger(prop)) {
                    const index = parseInt(prop);
                    return target._values[index];
                }
                return (target as any)[prop];
            },
            has(target, prop) {
                if (isPositiveInteger(prop)) {
                    const index = parseInt(prop);
                    return index < target._values.length;
                }
                return prop in target;
            },
            ownKeys(target) {
                return Array.from({ length: target._values.length }, (_, i) =>
                    String(i),
                );
            },
            getOwnPropertyDescriptor(target, prop) {
                if (isPositiveInteger(prop)) {
                    const index = parseInt(prop);
                    if (index < target._values.length) {
                        return {
                            value: target._values[index],
                            enumerable: true,
                            configurable: true,
                            writable: false,
                        };
                    }
                }
            },
        });
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
        return this._values.push(...values);
    }
    _sort(...values: Parameters<typeof Array.prototype.sort>) {
        return this._values.sort(...values);
    }
}

export default FakeDOMStringList;
