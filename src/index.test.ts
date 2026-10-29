import { afterEach, expect, test, vi } from "vitest";

afterEach(() => void vi.unstubAllGlobals());

test("keeps the full greeting as the heading's name and recipients as metadata", async () => {
	const heading = { id: "", innerText: "", setAttribute: vi.fn() };
	const document = {
		createElement: vi.fn(() => heading),
		body: { appendChild: vi.fn() },
	};
	vi.stubGlobal("window", { document });

	await import("./index");

	expect(document.createElement).toHaveBeenCalledWith("h1");
	expect(document.body.appendChild).toHaveBeenCalledWith(heading);
	expect(heading.innerText).toBe("Hello World");
	expect(heading.setAttribute.mock.calls).toEqual([["data-recipients", "World"]]);
});
