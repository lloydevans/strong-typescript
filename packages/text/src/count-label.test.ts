import { expect, it } from "vitest";
import { countLabel } from "./count-label";

it.each([
	[0, "Nothing"],
	[1, "1 item"],
	[2, "2 items"],
	[Number.MAX_SAFE_INTEGER, "9007199254740991 items"],
])("labels a count of %i", (count, expected) =>
	expect(countLabel({ count, empty: "Nothing", singular: "item", plural: "items" })).toBe(expected),
);

it.each([-1, 0.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1])("refuses an invalid count: %s", (count) =>
	expect(() => countLabel({ count, empty: "Nothing", singular: "item", plural: "items" })).toThrow(
		"Count must be a nonnegative safe integer",
	),
);
