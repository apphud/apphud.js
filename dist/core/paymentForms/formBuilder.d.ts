import { LifecycleEventName, PaymentFormBuilder, LifecycleEventCallback, PaymentProvider, PaymentProviderFormOptions, User, ProductBundle } from "../../types";
declare class FormBuilder implements PaymentFormBuilder {
    private provider;
    private user;
    private events;
    private currentForms;
    constructor(provider: PaymentProvider, user: User);
    /**
     * Generate a unique key for a payment form based on its type
     */
    private getFormKey;
    /**
     * Show form on page
     * @param productId - Product ID
     * @param paywallId - paywall user purchased from
     * @param placementId - placement id user purchased from
     * @param options - Form options. Success URL / Failure URL
     */
    show(productId: string, paywallId: string | undefined, placementId: string | undefined, options?: PaymentProviderFormOptions, bundle?: ProductBundle): Promise<void>;
    /**
     * Clean up specific form event listeners or all if no key is provided
     * @param formKey - Optional key to identify specific form to clean up
     */
    cleanup(formKey?: string): void;
    /**
     * Clean up all form event listeners
     */
    cleanupAll(): void;
    /**
     * Track event
     * @param eventName - event name
     * @param callback - callback function
     */
    on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void;
    emit(eventName: LifecycleEventName, event: any): void;
}
export default FormBuilder;
//# sourceMappingURL=formBuilder.d.ts.map