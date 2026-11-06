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

export const INVALID_METADATA_CODE = "invalid_metadata"

const findInvalidMetadataError = (error: HttpError) =>
    Array.isArray(error.body?.errors)
        ? error.body.errors.find(e => e?.code === INVALID_METADATA_CODE)
        : undefined

/**
 * The backend rejected the request metadata (422 with code invalid_metadata)
 * before calling Stripe. Another Stripe account would reject it the same way,
 * so this must not trigger the fallback account switch.
 */
export const isInvalidMetadataError = (error: unknown): error is HttpError =>
    isUnprocessableEntityError(error) && findInvalidMetadataError(error) !== undefined

/**
 * Human-readable reason of an invalid_metadata error, e.g. "metadata: must have at most 40 keys".
 */
export const invalidMetadataMessage = (error: HttpError): string => {
    const backendError = findInvalidMetadataError(error)
    if (!backendError?.title) {
        return error.message
    }
    return backendError.id ? `${backendError.id}: ${backendError.title}` : backendError.title
}
