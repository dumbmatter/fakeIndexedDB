import assert from "node:assert";
import "../auto/index.mjs";
import Dexie from "dexie";

const db = new Dexie("MyDatabase");

db.version(1).stores({
    friends: "++id, name, age",
});

await db.friends.add({
    name: "Alice",
    age: 25,
    street: "East 13:th Street",
});

await db.friends.add({
    name: "Bob",
    age: 80,
    street: "East 13:th Street",
});

const oldFriends = await db.friends.where("age").above(75).toArray();

assert.equal(oldFriends.length, 1);
process.exit(0);
