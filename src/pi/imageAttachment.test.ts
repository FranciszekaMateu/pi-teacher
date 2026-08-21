import { describe, expect, it } from "vitest";
import { validateImageAttachment } from "./imageAttachment";

describe("validateImageAttachment", () => {
	it("accepts supported image formats under the size limit", () => {
		expect(validateImageAttachment({ name: "diagram.png", type: "image/png", size: 1024 })).toEqual({ mimeType: "image/png" });
	});

	it("rejects an unsupported file type", () => {
		expect(() => validateImageAttachment({ name: "notes.pdf", type: "application/pdf", size: 100 })).toThrow("PNG, JPEG, WebP, or GIF");
	});

	it("rejects images over five MiB", () => {
		expect(() => validateImageAttachment({ name: "large.png", type: "image/png", size: 5 * 1024 * 1024 + 1 })).toThrow("5 MiB");
	});
});
