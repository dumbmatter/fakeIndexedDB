import { FakeDOMStringList } from "./types";

// Would be nicer to sublcass Array, but I'd have to sacrifice Node 4 support to do that.

const fakeDOMStringList = (arr: string[]): FakeDOMStringList => {
    const arr2 = arr.slice();

    Object.defineProperty(arr2, "contains", {
        // tslint:disable-next-line object-literal-shorthand
        value: (value: string) => arr2.indexOf(value) >= 0,
    });

    Object.defineProperty(arr2, "item", {
        // tslint:disable-next-line object-literal-shorthand
        value: (i: number) => arr2[i],
    });

    return arr2 as FakeDOMStringList;
};

export default fakeDOMStringList;
