import { describe, expect, it } from "vitest";
import { Greeter, type GreetingStyle, recipientSummary } from "./greeting";

describe("Greeter", () => {
	it("greets the world by default", () => expect(new Greeter().greet()).toBe("Hello World"));

	it("normalizes names and preserves their order without changing the input", () => {
		const greeter = new Greeter();
		const names = [" Vite ", "Ada"];
		const render = () => greeter.greet(names);

		expect(render()).toBe("Hello Vite\nHello Ada");
		expect(render()).toBe("Hello Vite\nHello Ada");
		expect(names).toEqual([" Vite ", "Ada"]);
	});

	it("returns empty text for an empty recipient list", () => expect(new Greeter().greet([])).toBe(""));

	it.each(["", " ", "\t"])("refuses blank names without affecting a later call: %j", (name) => {
		const greeter = new Greeter();
		expect(() => greeter.greet(["Ada", name])).toThrow("Recipient must not be blank");
		expect(greeter.greet(["Lin"])).toBe("Hello Lin");
	});

	it.each(["", " ", "\t"])("uses the supplied policy without accepting blank names: %j", (name) => {
		const style: GreetingStyle = {
			normalize: (name) => name.toUpperCase(),
			format: function (prefix, name) {
				return `${prefix}: ${name}!`;
			},
			join(messages) {
				return messages.join(" | ");
			},
		};
		const greeter = new Greeter(style);

		expect(() => greeter.greet(["Ada", name])).toThrow("Recipient must not be blank");
		expect(greeter.greet([" Ada ", "Lin"])).toBe("Hello:  ADA ! | Hello: LIN!");
	});
});

it.each([
	[0, "Nobody"],
	[1, "1 recipient"],
	[2, "2 recipients"],
	[Number.MAX_SAFE_INTEGER, "9007199254740991 recipients"],
])("summarizes %i recipients", (count, expected) =>
	expect(recipientSummary({ count, empty: "Nobody", singular: "recipient", plural: "recipients" })).toBe(expected),
);

it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])("refuses an invalid recipient count: %s", (count) =>
	expect(() => recipientSummary({ count, empty: "Nobody", singular: "recipient", plural: "recipients" })).toThrow(
		"Recipient count must be a nonnegative safe integer",
	),
);
