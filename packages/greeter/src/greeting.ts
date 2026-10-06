import { countLabel } from "@example/text";

/** Describe how recipient names become display text. */
export interface GreetingStyle {
	/**
	 * Prepare a supplied name for validation and display.
	 * @param name - The supplied recipient name.
	 * @returns The name used for validation and display.
	 */
	normalize(name: string): string;

	/**
	 * Address one recipient.
	 * @param prefix - The greeting's opening word.
	 * @param name - A normalized recipient name.
	 * @returns The complete greeting for that recipient.
	 */
	format(prefix: string, name: string): string;

	/**
	 * Combine greetings in their supplied order.
	 * @param messages - The individual greetings.
	 * @returns The display text, or an empty string for no recipients.
	 */
	join(messages: readonly string[]): string;
}

/** Trim recipient names and put each greeting on its own line. */
const plainStyle: GreetingStyle = {
	normalize: (name) => name.trim(),
	format: function (prefix, name) {
		return `${prefix} ${name}`;
	},
	join(messages) {
		return messages.join("\n");
	},
};

/** Address a list of recipients using a chosen presentation style. */
export class Greeter {
	/** The opening word shared by every greeting. */
	private readonly prefix = "Hello";

	/** The formatting policy for recipient names and messages. */
	private readonly style: GreetingStyle;

	/**
	 * Choose how recipient names and messages are presented.
	 * @param style - The formatting policy used for every call.
	 */
	constructor(style: GreetingStyle = plainStyle) {
		this.style = style;
	}

	/**
	 * Greet recipients in order without modifying the supplied list.
	 * @param names - Recipients to address, defaulting to the world.
	 * @returns The combined greetings, or an empty string for an empty list.
	 * @throws When any normalized name is blank.
	 */
	greet(names: readonly string[] = ["World"]) {
		const normalized = names.map((name) => this.style.normalize(name));
		if (normalized.some((name) => name.trim() === "")) {
			throw new Error("Recipient must not be blank");
		}

		return this.style.join(normalized.map((name) => this.style.format(this.prefix, name)));
	}
}

/**
 * Describe how many recipients will be greeted.
 * @param count - The number of recipients, a nonnegative safe integer.
 * @returns The empty text for zero recipients, otherwise the count and its label.
 * @throws When the count is not a nonnegative safe integer.
 */
export function recipientSummary(count: number) {
	return countLabel({ count, empty: "No recipients", singular: "recipient", plural: "recipients" });
}
