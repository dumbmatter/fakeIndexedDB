import * as assert from "assert";
import BinarySearchTree from "../../lib/binarySearchTree.js";
import FDBKeyRange from "../../FDBKeyRange.js";

const assertRecordsEqual = <T>(actual: Iterable<T>, expected: Array<T>) => {
    assert.deepStrictEqual([...actual], expected);
};

describe("binarySearchTree", () => {
    it("works for basic insertion and retrieval", () => {
        const tree = new BinarySearchTree();
        assert.equal(tree.size(), 0);
        tree.put({ key: "b", value: "b" });
        assert.equal(tree.size(), 1);
        tree.put({ key: "a", value: "a" });
        assert.equal(tree.size(), 2);
        tree.put({ key: "c", value: "c" });
        assert.equal(tree.size(), 3);
        assertRecordsEqual(tree.getAllRecords(), [
            { key: "a", value: "a" },
            { key: "b", value: "b" },
            { key: "c", value: "c" },
        ]);
    });

    it("overwrites duplicate key/value pairs", () => {
        const tree = new BinarySearchTree();
        tree.put({ key: "a", value: "a" });
        tree.put({ key: "a", value: "a" });
        tree.put({ key: "b", value: "x" });
        tree.put({ key: "b", value: "y" });
        tree.put({ key: "c", value: "c" });
        tree.put({ key: "a", value: "a" });
        assert.equal(tree.size(), 4);
        assertRecordsEqual(tree.getAllRecords(), [
            { key: "a", value: "a" },
            { key: "b", value: "x" },
            { key: "b", value: "y" },
            { key: "c", value: "c" },
        ]);
    });

    it("works for deletions", () => {
        const tree = new BinarySearchTree();
        tree.put({ key: "a", value: "a" });
        tree.put({ key: "b", value: "b" });
        tree.put({ key: "c", value: "c" });

        tree.delete({ key: "b", value: "b" });

        assert.equal(tree.size(), 2);
        assertRecordsEqual(tree.getAllRecords(), [
            { key: "a", value: "a" },
            { key: "c", value: "c" },
        ]);
    });

    it("works for deletions on nonexistent records", () => {
        const tree = new BinarySearchTree();
        tree.put({ key: "a", value: "a" });
        tree.put({ key: "b", value: "b" });
        tree.put({ key: "c", value: "c" });

        tree.delete({ key: "x", value: "x" });

        assert.equal(tree.size(), 3);
        assertRecordsEqual(tree.getAllRecords(), [
            { key: "a", value: "a" },
            { key: "b", value: "b" },
            { key: "c", value: "c" },
        ]);
    });

    it("can delete a lot", () => {
        const letters = "abcdefghijklmnopqrstuvwxyz";
        const tree = new BinarySearchTree();
        for (const letter of [...letters]) {
            tree.put({ key: letter, value: letter });
        }
        const expected = [...letters].map((letter) => ({
            key: letter,
            value: letter,
        }));
        assert.equal(tree.size(), expected.length);
        assertRecordsEqual(tree.getAllRecords(), expected);

        for (let i = 0; i < letters.length; i++) {
            const letter = letters.charAt(i);
            tree.delete({ key: letter, value: letter });
            assert.equal(tree.size(), expected.length - i - 1);
            assertRecordsEqual(tree.getAllRecords(), expected.slice(i + 1));
        }
    });

    it("works for get and getByKey", () => {
        const tree = new BinarySearchTree();
        tree.put({ key: "a", value: "a" });
        tree.put({ key: "b", value: "b" });
        tree.put({ key: "c", value: "c" });

        tree.delete({ key: "a", value: "a" });

        assert.deepStrictEqual(tree.get({ key: "b", value: "b" }), {
            key: "b",
            value: "b",
        });
        assertRecordsEqual(tree.getRecords(FDBKeyRange.only("b")), [
            {
                key: "b",
                value: "b",
            },
        ]);

        assert.equal(tree.get({ key: "x", value: "x" }), undefined);
        assertRecordsEqual(tree.getRecords(FDBKeyRange.only("x")), []);
    });

    describe("can do range searches", () => {
        [false, true].forEach((descending) => {
            const assertRecordsEqualGivenOrdering = <T>(
                actual: Iterable<T>,
                expected: Array<T>,
            ) => {
                assertRecordsEqual(
                    actual,
                    descending ? expected.reverse() : expected,
                );
            };

            it(`descending=${descending}`, () => {
                const tree = new BinarySearchTree();
                tree.put({ key: "c", value: "c" });
                tree.put({ key: "e", value: "e" });
                tree.put({ key: "a", value: "a" });
                tree.put({ key: "b", value: "b" });
                tree.put({ key: "d", value: "d" });

                // get all
                assert.equal(tree.size(), 5);
                assertRecordsEqualGivenOrdering(
                    tree.getAllRecords(descending),
                    [
                        { key: "a", value: "a" },
                        { key: "b", value: "b" },
                        { key: "c", value: "c" },
                        { key: "d", value: "d" },
                        { key: "e", value: "e" },
                    ],
                );

                // in bounds
                assertRecordsEqualGivenOrdering(
                    tree.getRecords(
                        new FDBKeyRange("b", "d", false, false),
                        descending,
                    ),
                    [
                        { key: "b", value: "b" },
                        { key: "c", value: "c" },
                        { key: "d", value: "d" },
                    ],
                );

                // out of bounds
                assertRecordsEqualGivenOrdering(
                    tree.getRecords(
                        new FDBKeyRange("0", "z", false, false),
                        descending,
                    ),
                    [
                        { key: "a", value: "a" },
                        { key: "b", value: "b" },
                        { key: "c", value: "c" },
                        { key: "d", value: "d" },
                        { key: "e", value: "e" },
                    ],
                );

                // lower/upper open
                assertRecordsEqualGivenOrdering(
                    tree.getRecords(
                        new FDBKeyRange("b", "d", true, true),
                        descending,
                    ),
                    [{ key: "c", value: "c" }],
                );

                // lower open only
                assertRecordsEqualGivenOrdering(
                    tree.getRecords(
                        new FDBKeyRange("b", "d", true, false),
                        descending,
                    ),
                    [
                        { key: "c", value: "c" },
                        { key: "d", value: "d" },
                    ],
                );

                // upper open only
                assertRecordsEqualGivenOrdering(
                    tree.getRecords(
                        new FDBKeyRange("b", "d", false, true),
                        descending,
                    ),
                    [
                        { key: "b", value: "b" },
                        { key: "c", value: "c" },
                    ],
                );
            });
        });
    });
});
