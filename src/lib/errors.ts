/* tslint:disable: max-classes-per-file max-line-length */

const messages = {
    AbortError:
        "A request was aborted, for example through a call to IDBTransaction.abort.",
    ConstraintError:
        "A mutation operation in the transaction failed because a constraint was not satisfied. For example, an object such as an object store or index already exists and a request attempted to create a new one.",
    DataCloneError:
        "The data being stored could not be cloned by the internal structured cloning algorithm.",
    DataError: "Data provided to an operation does not meet requirements.",
    InvalidAccessError:
        "An invalid operation was performed on an object. For example transaction creation attempt was made, but an empty scope was provided.",
    InvalidStateError:
        "An operation was called on an object on which it is not allowed or at a time when it is not allowed. Also occurs if a request is made on a source object that has been deleted or removed. Use TransactionInactiveError or ReadOnlyError when possible, as they are more specific variations of InvalidStateError.",
    NotFoundError:
        "The operation failed because the requested database object could not be found. For example, an object store did not exist but was being opened.",
    ReadOnlyError:
        'The mutating operation was attempted in a "readonly" transaction.',
    TransactionInactiveError:
        "A request was placed against a transaction which is currently not active, or which is finished.",
    VersionError:
        "An attempt was made to open a database using a lower version than the existing version.",
};

export class AbortError extends Error {
    constructor(message = messages.AbortError) {
        super();
        this.name = "AbortError";
        this.message = message;
    }
}

export class ConstraintError extends Error {
    constructor(message = messages.ConstraintError) {
        super();
        this.name = "ConstraintError";
        this.message = message;
    }
}

export class DataCloneError extends Error {
    constructor(message = messages.DataCloneError) {
        super();
        this.name = "DataCloneError";
        this.message = message;
    }
}

export class DataError extends Error {
    constructor(message = messages.DataError) {
        super();
        this.name = "DataError";
        this.message = message;
    }
}

export class InvalidAccessError extends Error {
    constructor(message = messages.InvalidAccessError) {
        super();
        this.name = "InvalidAccessError";
        this.message = message;
    }
}

export class InvalidStateError extends Error {
    constructor(message = messages.InvalidStateError) {
        super();
        this.name = "InvalidStateError";
        this.message = message;
    }
}

export class NotFoundError extends Error {
    constructor(message = messages.NotFoundError) {
        super();
        this.name = "NotFoundError";
        this.message = message;
    }
}

export class ReadOnlyError extends Error {
    constructor(message = messages.ReadOnlyError) {
        super();
        this.name = "ReadOnlyError";
        this.message = message;
    }
}

export class TransactionInactiveError extends Error {
    constructor(message = messages.TransactionInactiveError) {
        super();
        this.name = "TransactionInactiveError";
        this.message = message;
    }
}

export class VersionError extends Error {
    constructor(message = messages.VersionError) {
        super();
        this.name = "VersionError";
        this.message = message;
    }
}
