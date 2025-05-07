import {
    addPropertyControls,
    ControlType,
    RenderTarget,
    withCSS,
    Link,
} from "framer"
import React, { useEffect, useState, useRef, useId, ComponentType } from "react"
import { motion } from "framer-motion"
import { getCurrencyOptions, getCurrencyOptionTitles } from "./utils/currencies.ts"

declare const apphud: any

type ApplePayConfig =  {
    requestPayerName: boolean,
    requestPayerEmail: boolean,
    requestPayerPhone: boolean,
    priceMacro?: string,
    staticPrice?: {
        currency: string,
        label: string,
        amount: number
    },
    onApplePayAvailable: (isAvailable: boolean) => void
}

const PRODUCT_MACROS = [
    "full-price",
    "old-price",
    "new-price",
    "custom-1",
    "custom-2",
    "custom-3",
]

function ApplePayButtonComponent({
    style,
    customFont,
    radius,
    backgroundColor,
    textColor,
    buttonText,
    redirectType,
    redirectLink,
    successEvent,
    onApplePayAvailable,
    priceMode,
    priceMacro,
    currency,
    staticPriceItems,
    showAppleIcon,
    appleIconSize,
    appleIconColor,
    showPrefix,
    textPrefix,
    prefixLogoGap,
    logoTextGap,
    padding,
    border,
    shadow,
    hover,
    requestPayerName,
    requestPayerEmail,
    requestPayerPhone,
    loadingSpinner,
}) {
    const id = useInstanceId()
    const ref = useRef<HTMLDivElement>(null)
    const errorRef = useRef<HTMLDivElement>(null)
    const [state, setState] = useState("ready")
    const redirectLinkRef = useRef(null)
    const [isHovered, setIsHovered] = useState(false)
    const [isApplePayAvailable, setIsApplePayAvailable] = useState(false)
    
    const isLoading = state === "processing"
    const isDisabled = isLoading || state === "disabled"

    useEffect(() => {
        if (typeof apphud === "undefined") return

        function initializePaymentForm() {
            try {
                if (errorRef.current) {
                    errorRef.current.innerHTML = ""
                    errorRef.current.style.visibility = "hidden"
                }

                let applePayConfig: ApplePayConfig = {
                    requestPayerName,
                    requestPayerEmail,
                    requestPayerPhone,
                    onApplePayAvailable: (isAvailable: boolean) => {
                        setIsApplePayAvailable(isAvailable);
                        
                        // Trigger parent component's handler if provided
                        if (onApplePayAvailable) {
                            onApplePayAvailable();
                        }
                    }
                }

                if (priceMode === "macro") {
                    // Use price macro
                    applePayConfig.priceMacro = priceMacro
                } else {
                    // Use static values
                    // Get the current bundle index from SDK
                    const { bundleIndex } =
                        apphud.getSavedPlacementBundleIndex()
                    // Use the static price item that matches the bundle index, or the first one
                    const priceItem =
                        staticPriceItems[bundleIndex] ||
                        staticPriceItems[0] ||
                        {}

                    applePayConfig.staticPrice = {
                        currency,
                        label: priceItem.label || "Subscription",
                        amount: priceItem.amount || 0,
                    }
                }

                // Important: Set applePay: true to enable Apple Pay only mode
                apphud.paymentForm({
                    id,
                    paymentProvider: "stripe",
                    buttonStateSetter: setState,
                    onSuccess:
                        redirectType !== "appInstallPage"
                            ? () => {
                                  if (
                                      redirectType === "customLink" &&
                                      redirectLinkRef.current
                                  ) {
                                      redirectLinkRef.current.click()
                                  }

                                  successEvent?.()
                              }
                            : undefined,
                    applePay: true,
                    applePayConfig,
                })
                console.log("🍎 ApplePayButton: config", applePayConfig);
            } catch (err) {
                if (errorRef.current) {
                    errorRef.current.innerHTML = `Error: ${
                        err.message || "Failed to initialize Apple Pay"
                    }`
                    errorRef.current.style.visibility = "visible"
                }
                setState("ready")
            }
        }

        initializePaymentForm()

        const unsubscribe = apphud.on("product_changed", () => {
            console.log("🍎 ApplePayButton: product_changed event received");
            initializePaymentForm();
        });

        return () => {
            if (unsubscribe) {
                unsubscribe()
            }
        }
    }, [typeof apphud, priceMode, priceMacro, currency, staticPriceItems])

    // Apply hover styles if hover prop exists and isHovered is true
    const getHoverStyles = () => {
        if (!hover || !isHovered || isDisabled) return {}
        
        return {
            backgroundColor: hover.backgroundColor || backgroundColor,
            color: hover.textColor || textColor,
            boxShadow: hover.shadow || shadow,
            transform: hover.scale ? `scale(${hover.scale})` : undefined,
            transition: 'all 0.2s ease-in-out',
            ...(hover.border ? {
                borderWidth: hover.border.borderWidth,
                borderStyle: hover.border.borderStyle,
                borderColor: hover.border.borderColor,
            } : {}),
        }
    }

    return (
        <div
            ref={ref}
            id={`${id}-apphud-stripe-payment-form`}
            style={{
                position: "relative",
                width: "100%",
                ...style,
            }}
        >
            <button
                type="button"
                id={`${id}-apphud-apple-pay-button`}
                onMouseEnter={() => setIsHovered(true)}
                onMouseLeave={() => setIsHovered(false)}
                disabled={isDisabled}
                style={{
                    backgroundColor: backgroundColor,
                    color: textColor,
                    borderRadius: radius,
                    padding: padding,
                    width: "100%",
                    cursor: isDisabled ? "default" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 16,
                    fontWeight: 500,
                    ...customFont,
                    boxShadow: shadow,
                    borderWidth: border.borderWidth,
                    borderStyle: border.borderStyle,
                    borderColor: border.borderColor,
                    transition: 'all 0.2s ease-in-out',
                    opacity: state === "disabled" ? 0.6 : 1,
                    ...getHoverStyles(),
                    position: "relative",
                }}
            >
                <div 
                    style={{ 
                        display: "flex", 
                        flexDirection: "row", 
                        alignItems: "center", 
                        justifyContent: "center",
                        opacity: isLoading && loadingSpinner ? 0 : 1,
                    }}
                >
                    {showAppleIcon && showPrefix && textPrefix && (
                        <span style={{ marginRight: prefixLogoGap, display: "flex", alignItems: "center" }}>{textPrefix}</span>
                    )}
                    {showAppleIcon && (
                        <AppleLogoSVG 
                            size={appleIconSize} 
                            color={isHovered && hover?.appleIconColor ? hover.appleIconColor : appleIconColor} 
                            style={{ marginRight: logoTextGap, display: "inline-block" }}
                        />
                    )}
                    <span style={{ display: "flex", alignItems: "center" }}>{buttonText || "Apple Pay"}</span>
                </div>
                {isLoading && loadingSpinner && (
                    <LoadingSpinner
                        {...loadingSpinner}
                        color={loadingSpinner.color || textColor}
                    />
                )}
            </button>
            <div 
                ref={errorRef} 
                id={`${id}-error-message`} 
                style={{ 
                    color: "red", 
                    position: "absolute", 
                    visibility: "hidden", 
                    width: "100%",
                    top: "100%",
                    left: 0,
                    fontSize: "12px",
                    padding: "4px 0",
                    textAlign: "center",
                    pointerEvents: "none"
                }}
            ></div>
            {redirectType === "customLink" && redirectLink && (
                <Link
                    ref={redirectLinkRef}
                    href={redirectLink}
                    openInNewTab={false}
                    smoothScroll={false}
                >
                    <a style={{ display: "none" }} />
                </Link>
            )}
        </div>
    )
}

const AppleLogoSVG = ({ size = 20, color = "white", style = {} }) => (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width={size} 
        height={size} 
        viewBox="0 0 50 50"
        style={{ fill: color, ...style }}
    >
        <path d="M 44.527344 34.75 C 43.449219 37.144531 42.929688 38.214844 41.542969 40.328125 C 39.601563 43.28125 36.863281 46.96875 33.480469 46.992188 C 30.46875 47.019531 29.691406 45.027344 25.601563 45.0625 C 21.515625 45.082031 20.664063 47.03125 17.648438 47 C 14.261719 46.96875 11.671875 43.648438 9.730469 40.699219 C 4.300781 32.429688 3.726563 22.734375 7.082031 17.578125 C 9.457031 13.921875 13.210938 11.773438 16.738281 11.773438 C 20.332031 11.773438 22.589844 13.746094 25.558594 13.746094 C 28.441406 13.746094 30.195313 11.769531 34.351563 11.769531 C 37.492188 11.769531 40.8125 13.480469 43.1875 16.433594 C 35.421875 20.691406 36.683594 31.78125 44.527344 34.75 Z M 31.195313 8.46875 C 32.707031 6.527344 33.855469 3.789063 33.4375 1 C 30.972656 1.167969 28.089844 2.742188 26.40625 4.78125 C 24.878906 6.640625 23.613281 9.398438 24.105469 12.066406 C 26.796875 12.152344 29.582031 10.546875 31.195313 8.46875 Z"></path>
    </svg>
)

function LoadingSpinner({
    size = 16,
    strokeWidth = 2,
    color = "#ffffff",
    rounded = true,
}) {
    return (
        <div
            style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: size,
                height: size,
                pointerEvents: "none",
            }}
        >
            <motion.div
                animate={{
                    rotate: 360,
                }}
                transition={{
                    duration: 1,
                    repeat: Infinity,
                    ease: "linear",
                }}
                style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: "50%",
                    background: `conic-gradient(transparent, ${color} 340deg)`,
                    maskImage: `radial-gradient(transparent ${
                        size / 2 - strokeWidth
                    }px, white ${size / 2 - strokeWidth}px, white ${
                        size / 2
                    }px, transparent ${size / 2}px)`,
                }}
            >
                {strokeWidth < size / 2 && rounded && (
                    <div
                        style={{
                            position: "absolute",
                            top: 0,
                            left: (size - strokeWidth) / 2,
                            width: strokeWidth,
                            height: strokeWidth,
                            backgroundColor: color,
                            borderRadius: "50%",
                        }}
                    />
                )}
            </motion.div>
        </div>
    )
}

/**
 * @framerSupportedLayoutWidth fixed
 * @framerSupportedLayoutHeight any
 *
 * @framerDisableUnlink
 *
 * @framerIntrinsicWidth 300
 * @framerIntrinsicHeight 100
 */
const ApplePayButton: ComponentType = withCSS(
    ApplePayButtonComponent,
    [],
    ""
) as typeof ApplePayButtonComponent
export default ApplePayButton

ApplePayButton.displayName = "__form-apple-pay"

addPropertyControls(ApplePayButton, {
    // ===== Button Text & Content =====
    buttonText: {
        type: ControlType.String,
        defaultValue: "Apple Pay",
        title: "Button Text",
        description: "Text displayed on Apple Pay button",
    },
    // ===== Payment Processing Settings =====
    successEvent: {
        type: ControlType.EventHandler,
        title: "✅ Success",
    },
    onApplePayAvailable: {
        type: ControlType.EventHandler,
        title: "✅ Apple Pay Available",
        description: "Triggered when Apple Pay availability is checked",
    },
    redirectType: {
        type: ControlType.Enum,
        defaultValue: "appInstallPage",
        options: ["appInstallPage", "customLink", "nextStep"],
        optionTitles: ["Open app install page", "Open URL", "Go to next step"],
        title: "On Success Payment",
    },
    redirectLink: {
        type: ControlType.Link,
        title: "Link",
        hidden: (props) => props.redirectType !== "customLink",
    },
    // ===== Price Settings =====
    priceMode: {
        type: ControlType.Enum,
        defaultValue: "macro",
        options: ["macro", "static"],
        optionTitles: ["Macro", "Static"],
        title: "Price Mode",
        description: "'Macro' pulls price from Macros variables configured in Apphud, while 'Static' lets you set a fixed prices directly.",
        displaySegmentedControl: true,
        segmentedControlDirection: "horizontal",
    },
    priceMacro: {
        type: ControlType.Enum,
        defaultValue: "new-price",
        options: PRODUCT_MACROS,
        title: "Price Macro",
        description: "Select a macro to pull price information. The macro value should be formatted as '{currency symbol}{amount}' (e.g., '$19.99', '€15.00').",
        hidden: (props) => props.priceMode !== "macro",
    },
    currency: {
        type: ControlType.Enum,
        defaultValue: "usd",
        options: getCurrencyOptions(),
        optionTitles: getCurrencyOptionTitles(),
        title: "Currency",
        hidden: (props) => props.priceMode !== "static",
    },
    staticPriceItems: {
        type: ControlType.Array,
        title: "Price Items",
        description: "Define price items in the same order as products appear in your paywall. Each item needs a label and amount value.",
        defaultValue: [
            { label: "Monthly Subscription", amount: 999 },
            { label: "Annual Subscription", amount: 9999 },
        ],
        propertyControl: {
            type: ControlType.Object,
            controls: {
                label: {
                    type: ControlType.String,
                    title: "Label",
                    defaultValue: "Subscription",
                },
                amount: {
                    type: ControlType.Number,
                    title: "Amount (cents)",
                    description: "Enter the price in currency subunit (e.g., cents, pence). For example, $9.99 should be entered as 999, €25.50 as 2550.",
                    defaultValue: 999,
                    displayStepper: true,
                    min: 0,
                    step: 100,
                },
            },
        },
        hidden: (props) => props.priceMode !== "static",
    },
    // ===== Apple Pay Customer Data =====
    requestPayerName: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Request Name",
        description: "Ask for customer's name during Apple Pay checkout",
    },
    requestPayerEmail: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Request Email",
        description: "Ask for customer's email during Apple Pay checkout",
    },
    requestPayerPhone: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Request Phone",
        description: "Ask for customer's phone number during Apple Pay checkout",
    },
    // ===== Apple Logo Settings =====
    showAppleIcon: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Show Apple Logo",
    },
    appleIconSize: {
        type: ControlType.Number,
        defaultValue: 20,
        min: 12,
        max: 48,
        step: 1,
        displayStepper: true,
        title: "Logo Size",
        hidden: (props) => !props.showAppleIcon,
    },
    appleIconColor: {
        type: ControlType.Color,
        defaultValue: "#ffffff",
        title: "Logo Color",
        hidden: (props) => !props.showAppleIcon,
    },
    logoTextGap: {
        type: ControlType.Number,
        defaultValue: 4,
        min: 0,
        max: 32,
        step: 1,
        displayStepper: true,
        title: "Logo-Text Gap",
        description: "Space between Apple logo and button text in pixels",
        hidden: (props) => !props.showAppleIcon,
    },
    // ===== Prefix Text Settings =====
    showPrefix: {
        type: ControlType.Boolean,
        defaultValue: false,
        title: "Show Prefix Text",
        hidden: (props) => !props.showAppleIcon,
    },
    textPrefix: {
        type: ControlType.String,
        defaultValue: "Pay with",
        title: "Prefix Text",
        description: "Text displayed before Apple logo (e.g. 'Pay with')",
        hidden: (props) => !props.showAppleIcon || !props.showPrefix,
    },
    prefixLogoGap: {
        type: ControlType.Number,
        defaultValue: 4,
        min: 0,
        max: 32,
        step: 1,
        displayStepper: true,
        title: "Prefix-Logo Gap",
        description: "Space between prefix text and Apple logo in pixels",
        hidden: (props) => !props.showAppleIcon || !props.showPrefix,
    },
    // ===== Button Styling =====
    backgroundColor: {
        type: ControlType.Color,
        title: "Background Color",
        defaultValue: "#000000",
    },
    textColor: {
        type: ControlType.Color,
        title: "Text Color",
        defaultValue: "#ffffff",
    },
    customFont: {
        type: ControlType.Font,
        title: "Font",
        controls: "extended",
        defaultValue: {
            fontSize: 16,
        },
    },
    radius: {
        type: ControlType.BorderRadius,
        defaultValue: "8px",
    },
    padding: {
        type: ControlType.Padding,
        defaultValue: "8px",
    },
    border: {
        type: ControlType.Border,
        defaultValue: {
            borderWidth: 0,
            borderStyle: "solid",
            borderColor: "rgba(0, 0, 0, 0)",
        },
    },
    shadow: {
        type: ControlType.BoxShadow,
        defaultValue: "0px 1px 2px 0px rgba(0,0,0,0.25)",
    },
    // ===== Hover Effects =====
    hover: {
        type: ControlType.Object,
        title: "Hover Effects",
        controls: {
            backgroundColor: {
                type: ControlType.Color,
                title: "Background Color",
                defaultValue: "#222222",
            },
            textColor: {
                type: ControlType.Color,
                title: "Text Color",
                defaultValue: "#ffffff",
            },
            appleIconColor: {
                type: ControlType.Color,
                title: "Logo Color",
                defaultValue: "#ffffff",
            },
            border: {
                type: ControlType.Border,
                title: "Border",
                defaultValue: {
                    borderWidth: 0,
                    borderStyle: "solid",
                    borderColor: "rgba(255, 255, 255, 0.3)",
                },
            },
            shadow: {
                type: ControlType.BoxShadow,
                title: "Shadow",
                defaultValue: "0px 2px 4px 0px rgba(0,0,0,0.3)",
            },
            scale: {
                type: ControlType.Number,
                title: "Scale",
                defaultValue: 1,
                min: 0.9,
                max: 1.2,
                step: 0.01,
                displayStepper: true,
            },
        },
    },
    // ===== Loading Spinner =====
    loadingSpinner: {
        type: ControlType.Object,
        title: "Loading Spinner",
        optional: true,
        defaultValue: {
            size: 20,
            strokeWidth: 2,
            rounded: true
        },
        controls: {
            size: {
                type: ControlType.Number,
                defaultValue: 20,
                min: 10,
                max: 50,
                step: 1,
                displayStepper: true,
                title: "Size",
            },
            strokeWidth: {
                type: ControlType.Number,
                defaultValue: 2,
                min: 1,
                max: 10,
                step: 1,
                displayStepper: true,
                title: "Stroke Width",
            },
            color: {
                type: ControlType.Color,
                optional: true,
                title: "Color",
            },
            rounded: {
                type: ControlType.Boolean,
                defaultValue: true,
                title: "Rounded",
            },
        },
    },
})

const useInstanceId = () => {
    const id = useId()
    const cleanId = id.replace(/:/g, "")
    const instanceId = `apphud-${cleanId}`

    return instanceId
}
