export interface Error {
    id: string
    title: string
}

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
