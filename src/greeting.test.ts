import { describe, expect, it } from "vitest";
import { greeting } from "./greeting";

describe("greeting", () => {
	it("greets the world by default", () => {
		expect(greeting()).toBe("Hello World");
	});

	it("greets by name", () => {
		expect(greeting("Vite")).toBe("Hello Vite");
	});
});
