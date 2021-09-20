import { FakeDOMStringList as foo } from "./types.js";

// Subclass Array to get nice behaviors like destructuring, but delete various Array methods that don't exist on DOMStringList https://github.com/dumbmatter/fakeIndexedDB/issues/66#issuecomment-922407403

class FakeDOMStringList extends Array<string> {
    contains(value: string) {
        for (const value2 of this) {
            if (value === value2) {
                return true;
            }
        }
        return false;
    }

    item(i: number) {
        return this[i];
    }
}

const fakeDOMStringList = (array: string[]): FakeDOMStringList => {
    return new FakeDOMStringList(...array);
};

export default fakeDOMStringList;
