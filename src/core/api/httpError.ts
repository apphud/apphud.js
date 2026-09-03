import { BackendResponse } from "../../types";

export class HttpError extends globalThis.Error {
    status: number
    body: BackendResponse | null

    constructor(status: number, body: BackendResponse | null, message?: string) {
        super(message || `HTTP ${status}`)
        // TS target es5: `Error.call(this)` returns a native Error, so `this`
        // would otherwise not be an HttpError instance.
        Object.setPrototypeOf(this, HttpError.prototype)
        this.name = "HttpError"
        this.status = status
        this.body = body
    }
}

const isHttpError = (error: unknown): error is HttpError =>
    typeof error === "object"
    && error !== null
    && (error as HttpError).name === "HttpError"
    && typeof (error as HttpError).status === "number"

export const isUnprocessableEntityError = (error: unknown): error is HttpError =>
    isHttpError(error) && error.status === 422
