import { describe, expect, it } from "vitest";
import { providedSourceUrls } from "./providedSources";

describe("provided source URLs", () => {
	it("extracts deduplicated http sources explicitly present in a learner prompt", () => {
		expect(providedSourceUrls("Usá https://example.edu/a y https://example.edu/a. También http://docs.example/b"))
			.toEqual(["https://example.edu/a", "http://docs.example/b"]);
	});
	it("rejects non-web and private-network URLs", () => {
		expect(providedSourceUrls("file:///secret http://localhost:3000 https://127.0.0.1/x")).toEqual([]);
	});
});
