import { UpsellForm } from "../../types/upsellForm";
import { IntroductoryOffer, UpsellSubscriptionOptions } from "../../types";
import { log, logError } from "../../utils";
import api from "../api";
import { config } from "../config/config";
import { DeepLinkURL, SelectedProductDuration, PaymentProviderKey } from "../config/constants";
import { setCookie } from "../../cookies";
import UpsellBuilder from "./upsellBuilder";

class StripeUpsellForm implements UpsellForm {
    constructor(
        private user: any,
        private providerId: string,
        private paywallId: string,
        private placementId: string,
        private productId: string,
        private upsellBuilder: UpsellBuilder
    ) {}

    /**
     * Process Stripe upsell subscription
     * @param options - Upsell options
     * @param introOffer - Optional introductory offer details
     */
    public async process(options: UpsellSubscriptionOptions, introOffer?: IntroductoryOffer): Promise<boolean> {
        try {
            this.upsellBuilder.emit("upsell_initiated", {
                paymentProvider: "stripe",
                event: {
                    paywallId: this.paywallId,
                    placementId: this.placementId
                }
            });

            // Create subscription payload
            const subscriptionPayload: any = {
                product_id: this.productId,
                paywall_id: this.paywallId,
                placement_id: this.placementId,
                user_id: this.user.id,
                upsell: true
            };

            // Add trial days if available
            if (introOffer?.stripe_free_trial_days) {
                subscriptionPayload.trial_period_days = parseInt(introOffer.stripe_free_trial_days);
            }

            // Add coupon if available
            if (introOffer?.stripe_coupon_id) {
                subscriptionPayload.discount_id = introOffer.stripe_coupon_id;
            }

            // Create the subscription
            const subscription = await api.createSubscription(this.providerId, subscriptionPayload);

            if (!subscription) {
                throw new Error("Failed to create subscription");
            }

            // Save deep link if available
            if (subscription.deep_link) {
                setCookie(DeepLinkURL, subscription.deep_link, SelectedProductDuration);
            }

            // Save payment provider type
            setCookie(PaymentProviderKey, "stripe", SelectedProductDuration);

            // Emit success event
            this.upsellBuilder.emit("upsell_success", {
                paymentProvider: "stripe",
                event: {
                    subscription: subscription
                }
            });

            // Handle redirect or callback
            setTimeout(() => {
                if (options?.onSuccess) {
                    options.onSuccess();
                } else if (options?.successUrl && options.successUrl !== 'undefined') {
                    document.location.href = options.successUrl;
                } else {
                    document.location.href = config.baseSuccessURL + '/' + subscription.deep_link;
                }
            }, config.redirectDelay);

            return true;
        } catch (error) {
            logError("Failed to process Stripe upsell:", error, true);
            this.upsellBuilder.emit("upsell_failure", {
                paymentProvider: "stripe",
                event: { error }
            });
            return false;
        }
    }
}

export default StripeUpsellForm; 