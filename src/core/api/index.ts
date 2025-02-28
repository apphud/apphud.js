import u, { logError } from '../../utils';
import {config} from "../config/config";
import {
    CustomerData,
    Events,
    ApphudHash,
    User,
    BackendResponse,
    SubscriptionParams,
    Subscription,
    Message,
    SuccessMessage,
    AttributionData,
    CustomerSetup,
    CustomerParams
} from "../../types";
import router from "./router";

/**
 * Prepare base headers
 */
const baseHeaders = (): HeadersInit => {
    return {
        "X-SDK": "web2web",
        "X-SDK-VERSION": "2.0.0",
        "X-Platform": "web2web",
        "X-Store": "web2web",
        "Content-Type": "application/json; charset=utf-8"
    }
}

/**
 * Create user
 * @param data - user data
 */
const createUser = async (data: CustomerData): Promise<User> => {
    const response = await sendRequest('POST', router.userUrl(), data)

    return response.data.results as User;
}

const setAttribution = async (queryParams: string, data: AttributionData): Promise<SuccessMessage> => {
    const response = await sendRequest('POST', router.attributionUrl(queryParams), data)
    return response.data.results as SuccessMessage;
}

/**
 * Create event
 * @param data - event data
 */
const createEvent = async (data: Events): Promise<Message> => {
    const response = await sendRequest('POST', router.eventUrl(), data)

    return response.data.results as Message;
}

/**
 * Create subscription
 * @param providerId - Payment Provider ID returned with user
 * @param data - subscription data (product_id, user_id)
 */
const createSubscription = async (providerId: string, data: SubscriptionParams): Promise<Subscription> => {
    const response = await sendRequest('POST', router.subscribeUrl(providerId), data)

    if (response.errors && response.errors.length > 0) {
        logError('Subscription creation failed:', response.errors);
    }

    return response.data.results as Subscription;
}

const createCustomer = async (providerId: string, data: CustomerParams): Promise<CustomerSetup> => {
    const response = await sendRequest('POST', router.customerUrl(providerId), data)

    if (response.errors && response.errors.length > 0) {
        logError('Customer creation failed:', response.errors);
    }

    return response.data.results as CustomerSetup;
}

/**
 * Send request to API. General function
 * @param method - http method
 * @param url - url
 * @param data - request body / params
 */
const sendRequest = async (method: string, url: string, data?: ApphudHash | null): Promise<BackendResponse> => {
    async function attempt(retryCount: number): Promise<BackendResponse> {
        let delay = config.httpRetryDelay || 1000

        const headers: HeadersInit = {
            'Content-Type': 'application/json; charset=utf-8',
            'Authorization': `Bearer ${config.apiKey}`,
            ...config.headers
        }

        const fetchParams: RequestInit = {
            method: method,
            headers: headers,
            credentials: 'same-origin'
        }

        if ((method === 'POST' || method === 'PUT') && data) {
            fetchParams.body = JSON.stringify(data)
        }

        try {
            const response = await fetch(url, fetchParams)

            if (!response.ok) {
                throw new Error('Network response was not ok');
            }

            return await response.json() as BackendResponse;
        } catch (error) {
            console.error('Attempt failed:', error);

            if (retryCount < (config.httpRetriesCount || 3)) {
                await u.sleep(delay);
                delay *= 2; // Exponential backoff
                return attempt(retryCount + 1);
            } else {
                console.error('All retries failed.');
                throw error;
            }
        }
    }

    return await attempt(0);
}

export default {createUser, createEvent, baseHeaders, createSubscription, setAttribution, createCustomer}
