describe("jest", () => {
    it("jest", () => {
        if (typeof indexedDB === "undefined") {
            throw new Error("undefind indexeDB");
        }
    });
});
