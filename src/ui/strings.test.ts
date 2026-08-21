import { describe, expect, it } from "vitest";
import { chatStrings, resolveUiLanguage } from "./strings";

describe("resolveUiLanguage", () => {
	it("honors an explicit language preference", () => {
		expect(resolveUiLanguage("es", "en-US")).toBe("es");
		expect(resolveUiLanguage("en", "es-ES")).toBe("en");
	});

	it("auto-detects Spanish from any Spanish locale variant", () => {
		expect(resolveUiLanguage("auto", "es")).toBe("es");
		expect(resolveUiLanguage("auto", "es-419")).toBe("es");
		expect(resolveUiLanguage("auto", "ES-mx")).toBe("es");
	});

	it("falls back to English for non-Spanish locales", () => {
		expect(resolveUiLanguage("auto", "en")).toBe("en");
		expect(resolveUiLanguage("auto", "de")).toBe("en");
		expect(resolveUiLanguage("auto", "")).toBe("en");
	});
});

describe("chatStrings", () => {
	it("exposes the same keys in both languages", () => {
		expect(Object.keys(chatStrings("es"))).toEqual(Object.keys(chatStrings("en")));
	});

	it("pluralizes saved counts per language", () => {
		expect(chatStrings("en").savedCount(1)).toBe("1 saved");
		expect(chatStrings("en").savedCount(3)).toBe("3 saved");
		expect(chatStrings("es").savedCount(1)).toBe("1 guardado");
		expect(chatStrings("es").savedCount(3)).toBe("3 guardados");
	});
});
