/**
 * Combine a count with its singular or plural label.
 * @param options - The count and the words used to describe it.
 * @returns The empty text for zero, otherwise the count and its label.
 * @throws When the count is not a nonnegative safe integer.
 */
export function countLabel({
	count,
	empty,
	singular,
	plural,
}: {
	/** A nonnegative safe integer. */
	count: number;

	/** Text for a count of zero. */
	empty: string;

	/** The label for one item. */
	singular: string;

	/** The label for multiple items. */
	plural: string;
}) {
	if (!Number.isSafeInteger(count) || count < 0) {
		throw new Error("Count must be a nonnegative safe integer");
	}

	if (count === 0) {
		return empty;
	}

	if (count === 1) {
		return `${count} ${singular}`;
	}

	return `${count} ${plural}`;
}
