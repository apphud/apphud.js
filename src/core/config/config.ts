import {Config} from '../../types'

export const config: Config = {
    apiKey: "",
    baseURL: "https://api.apphud.com/v1",
    baseSuccessURL: "https://getapp.apphud.com",
    debug: false,
    websiteVersion: '0.0.1',
    httpRetriesCount: 3,
    language: "en",
    httpRetryDelay: 1000,
    redirectDelay: 1000,
    headers: {},
    disableCookies: false,
};
