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

it("summarizes recipients with the greeter's wording", () => {
	expect(recipientSummary(0)).toBe("No recipients");
	expect(recipientSummary(1)).toBe("1 recipient");
	expect(recipientSummary(2)).toBe("2 recipients");
	expect(() => recipientSummary(-1)).toThrow("Count must be a nonnegative safe integer");
});
