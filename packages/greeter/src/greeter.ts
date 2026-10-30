import { countLabel } from "@example/text";

/** The opening word shared by the default greetings. */
const DEFAULT_PREFIX = "Hello";

/** One recipient or an ordered list of recipients. */
export type Recipients = string | readonly string[];

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

/**
 * Put a single string in a list, preserving an existing list.
 * @param values - One string or an ordered list of strings.
 * @returns The strings in their supplied order.
 */
function toList<Value extends string>(values: Value | readonly Value[]) {
	return typeof values === "string" ? [values] : values;
}

/**
 * Remove surrounding whitespace from a recipient's name.
 * @param name - The supplied recipient name.
 * @returns The name without surrounding whitespace.
 */
function normalizeName(name: string) {
	return name.trim();
}

/** Trim recipient names and put each greeting on its own line. */
const plainStyle: GreetingStyle = {
	normalize: normalizeName,
	format: function (prefix, name) {
		return `${prefix} ${name}`;
	},
	join(messages) {
		return messages.join("\n");
	},
};

/** Present recipient names without a greeting's opening word. */
export const namesOnlyStyle: GreetingStyle = {
	...plainStyle,
	format: (_prefix, name) => name,
};

/** Address one or more recipients using a chosen presentation style. */
export class Greeter {
	/** The opening word shared by every greeting. */
	readonly #prefix = DEFAULT_PREFIX;

	/** The formatting policy for recipient names and messages. */
	readonly #style: GreetingStyle;

	/**
	 * Choose how recipient names and messages are presented.
	 * @param style - The formatting policy used for every call.
	 */
	constructor(style: GreetingStyle = plainStyle) {
		this.#style = style;
	}

	/**
	 * Greet recipients in order without modifying the supplied list.
	 * @param names - Recipients to address, defaulting to the world.
	 * @returns The combined greetings, or an empty string for an empty list.
	 * @throws When any normalized name is blank.
	 */
	greet(names: Recipients = "World") {
		const normalized = toList(names).map((name) => this.#style.normalize(name));
		if (normalized.some((name) => name.trim() === "")) {
			throw new Error("Recipient must not be blank");
		}

		return this.#style.join(normalized.map((name) => this.#style.format(this.#prefix, name)));
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
