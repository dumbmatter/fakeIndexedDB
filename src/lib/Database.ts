// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-database
class Database {
    public deletePending = false;
    public readonly transactions: any[] = [];
    public readonly rawObjectStores = {};
    public readonly connections = [];

    public readonly name: string;
    public version: number;

    constructor(name: string, version: number) {
        this.name = name;
        this.version = version;

        this.processTransactions = this.processTransactions.bind(this);
    }

    public processTransactions() {
        setImmediate(() => {
            const anyRunning = this.transactions.some((transaction) => {
                return transaction._started && !transaction._finished;
            });

            if (!anyRunning) {
                const next = this.transactions.find((transaction) => {
                    return !transaction._started && !transaction._finished;
                });

                if (next) {
                    next._start();

                    next.addEventListener("complete", this.processTransactions);
                    next.addEventListener("abort", this.processTransactions);
                }
            }
        });
    }
}

export default Database;
