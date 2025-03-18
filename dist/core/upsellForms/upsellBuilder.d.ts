import { LifecycleEventName, LifecycleEventCallback, PaymentProvider, UpsellSubscriptionOptions, User, ProductBundle } from "../../types";
declare class UpsellBuilder {
    private provider;
    private user;
    private paywallId;
    private placementId;
    private bundle;
    private productId;
    private events;
    private currentForm;
    constructor(provider: PaymentProvider, user: User, paywallId: string, placementId: string, bundle: ProductBundle, productId: string);
    /**
     * Process upsell subscription
     * @param options - Upsell options including success URL / callbacks
     */
    process(options?: UpsellSubscriptionOptions): Promise<boolean>;
    /**
     * Clean up any existing form resources
     */
    cleanup(): void;
    /**
     * Register event listener
     * @param eventName - event name
     * @param callback - callback function
     */
    on(eventName: LifecycleEventName, callback: LifecycleEventCallback): void;
    /**
     * Emit event to registered listeners
     * @param eventName - event name
     * @param event - event data
     */
    emit(eventName: LifecycleEventName, event: any): void;
}
export default UpsellBuilder;
//# sourceMappingURL=upsellBuilder.d.ts.map