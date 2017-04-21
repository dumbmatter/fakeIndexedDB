import {FakeDOMStringList} from "./types";

// Would be nicer to sublcass Array, but I'd have to sacrifice Node 4 support to do that.

const fakeDOMStringList = (arr: string[]): FakeDOMStringList => {
    const arr2 = arr.slice();

    Object.defineProperty(arr2, "contains", {
        // tslint:disable-next-line object-literal-shorthand
        value: function(value: string) { return this.indexOf(value) >= 0; },
    });

    Object.defineProperty(arr2, "item", {
        // tslint:disable-next-line object-literal-shorthand
        value: function(i: number) { return this[i]; },
    });

    return arr2 as FakeDOMStringList;
};

export default fakeDOMStringList;
