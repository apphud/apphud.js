export interface Error {
    id: string
    title: string
}

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

export interface BackendResponse {
    data: { results: object, meta: object }
    errors: Error[]
}


export interface SubscriptionParams {
    user_id: string
    product_id: string
    paywall_id?: string
    placement_id?: string
    customer_id?: string
    payment_method_id?: string
    trial_period_days?: number
    discount_id?: string
    metadata?: {
        amplitude_id?: string | null
        [key: string]: any
    }
}

export interface Subscription {
    id: string
    client_secret?: string
    deep_link?: string
    customer_id?: string
    auth_token?: string
    payment_method?: string
    amount?: string | number
    transaction_id?: string
}

export interface CustomerSetup {
    id: string               
    client_secret: string    
}

export interface CustomerParams {
    user_id: string
    payment_methods?: string[],
    metadata?: {
        amplitude_id?: string | null
        [key: string]: any
    }
}
