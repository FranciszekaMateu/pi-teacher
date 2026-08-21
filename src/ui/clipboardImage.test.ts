import { describe, expect, it } from "vitest";
import { firstPastedImage } from "./clipboardImage";

describe("firstPastedImage", () => {
	it("returns an image file from clipboard files", () => {
		const image = { type: "image/png" } as File;
		expect(firstPastedImage([image] as unknown as FileList)).toBe(image);
	});

	it("does not treat non-image clipboard files as an attachment", () => {
		const textFile = { type: "text/plain" } as File;
		expect(firstPastedImage([textFile] as unknown as FileList)).toBeUndefined();
	});
});
