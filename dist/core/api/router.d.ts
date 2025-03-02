interface Router {
    userUrl: () => string;
    eventUrl: () => string;
    attributionUrl: (queryParams: string) => string;
    paymentIntentUrl: (providerId: string) => string;
    subscribeUrl: (providerId: string) => string;
    customerUrl: (providerId: string) => string;
    errorReportingUrl: () => string;
}
declare const router: Router;
export default router;
//# sourceMappingURL=router.d.ts.map