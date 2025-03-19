import { IntroductoryOffer, UpsellSubscriptionOptions } from "./paymentForm";

export interface UpsellForm {
    /**
     * Process the upsell subscription
     * @param options - Configuration options for the upsell
     * @param introOffer - Optional introductory offer details
     * @returns Promise<boolean> - Whether the upsell was successfully processed
     */
    process(options: UpsellSubscriptionOptions, introOffer?: IntroductoryOffer): Promise<boolean>;
}

// Add this to your types/index.ts to export it
export * from './upsellForm'; 