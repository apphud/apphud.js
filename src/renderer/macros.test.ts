import { describe, expect, it } from "vitest";
import { formatText, type MacroContext } from "./macros";

const context = (locale: string): MacroContext => ({
  locale,
  defaultLocale: "en",
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

    it("empties product macros: prices are plain text now", () => {
      expect(
        formatText("[{{ products[0].formatted_price }}]", context("en")),
      ).toBe("[]");
    });
  });
});
