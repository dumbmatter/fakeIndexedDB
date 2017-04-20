import "setimmediate";
import FDBFactory from "./FDBFactory";

const fakeIndexedDB = new FDBFactory();

module.exports = fakeIndexedDB;
