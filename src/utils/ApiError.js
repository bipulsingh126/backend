class ApiError extends Error {
    constructor(
        statuscode,
        message = "Somthing went wrong",
        errors = [],
        statck = "",
    ){
        super(message);
        this.statuscode = statuscode;
        this.data = null;
        this.message = message;
        this.success = false;
        this.errors = errors;


        if (statck) {
            this.stack = statck;
        }else {
            Error.captureStackTrace(this, this.constructor); // this is the line that is giving error
        }
    }
}

export { ApiError };