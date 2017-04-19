class FakeDOMStringList extends Array<string> {
    public static from(arr: string[]): FakeDOMStringList {
        // This does actually work, despite TypeScript thinking it won't without the "as"!
        return super.from(arr) as FakeDOMStringList;
    }

    public contains(value: string) {
        return this.indexOf(value) >= 0;
    }

    public item(i: number) {
        return this[i];
    }
}

export default FakeDOMStringList;
