describe("jest", () => {
    it("auto in setupFiles", () => {
        if (typeof indexedDB === "undefined") {
            throw new Error("undefind indexeDB");
        }
    });
});
