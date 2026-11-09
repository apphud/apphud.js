import { describe, expect, it } from "vitest";
import { formatText, type MacroContext } from "./macros";

const context = (locale: string, erase = false): MacroContext => ({
  locale,
  defaultLocale: "en",
  erase,
  now: () => new Date(2026, 0, 10, 12),
});

describe("macros", () => {
  describe("formatText", () => {
    it("picks the requested locale and falls back to the default one", () => {
      const value = { en: "$49.99 / year", ru: "49,99 $ / год" };
      expect(formatText(value, context("en"))).toBe("$49.99 / year");
      expect(formatText(value, context("ru"))).toBe("49,99 $ / год");
      expect(formatText({ en: "Hello" }, context("ru"))).toBe("Hello");
      expect(formatText("plain", context("ru"))).toBe("plain");
      expect(formatText(null, context("en"))).toBe("");
    });

    it("adds days to today in the current locale", () => {
      expect(
        formatText("Free until {{ today | add_days: 3 }}", context("en")),
      ).toBe("Free until Jan 13");
      expect(
        formatText({ ru: "до {{ today | add_days: 3 }}" }, context("ru")),
      ).toMatch(/^до 13 янв/);
    });

    it("empties macros it cannot compute: no Liquid for the buyer", () => {
      expect(
        formatText("[{{ products[0].formatted_price }}]", context("en", true)),
      ).toBe("[]");
    });

    it("drops Liquid tags on the page and keeps them in the builder", () => {
      const value =
        "A {% if product.intro_mode %}trial{% endif %} B {% unless x %}C{% endunless %}";
      expect(formatText(value, context("en", true))).toBe("A trial B C");
      expect(formatText(value, context("en"))).toBe(value);
    });

    it("computes only today with numeric add_days, and never throws", () => {
      const builder = context("en");
      const value = "till {{ today | add_days: product.trial_days }}";
      expect(formatText(value, builder)).toBe(value);
      expect(formatText(value, context("en", true))).toBe("till ");
      expect(formatText("{{ x | add_days: 3 }}", context("en", true))).toBe("");
      expect(formatText("{{ today }}", context("en"))).toBe("Jan 10");
    });

    it("keeps them as written for the builder, and still computes today", () => {
      const builder = context("en");
      expect(
        formatText(
          "123 {{ product.formatted_price }} till {{ today | add_days: 3 }}",
          builder,
        ),
      ).toBe("123 {{ product.formatted_price }} till Jan 13");
    });
  });
});
