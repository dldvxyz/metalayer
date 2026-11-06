import { describe, expect, it } from "vitest";

import {
  splitAsciiWhitespace,
  trimAsciiWhitespace,
  utf8ByteLength
} from "../src/shared/text.js";

const NO_BREAK_SPACE = String.fromCodePoint(0xa0);

describe(trimAsciiWhitespace, () => {
  it.each([
    ["  red\t", "red"],
    ["\n\f\r red", "red"],
    ["red", "red"],
    [`red${NO_BREAK_SPACE}`, `red${NO_BREAK_SPACE}`],
    ["", ""]
  ])("trims %j to %j", (input, expected) => {
    expect(trimAsciiWhitespace(input)).toBe(expected);
  });
});

describe(splitAsciiWhitespace, () => {
  it.each([
    ["any maskable", ["any", "maskable"]],
    ["  16x16\t32x32 \n", ["16x16", "32x32"]],
    [`any${NO_BREAK_SPACE}maskable`, [`any${NO_BREAK_SPACE}maskable`]],
    ["", []],
    ["   ", []]
  ])("splits %j", (input, expected) => {
    expect(splitAsciiWhitespace(input)).toStrictEqual(expected);
  });
});

describe(utf8ByteLength, () => {
  it.each([
    ["", 0],
    ["abc", 3],
    ["é", 2],
    ["€", 3],
    ["😀", 4],
    ["a€😀", 8]
  ])("measures %j as %d bytes", (input, expected) => {
    expect(utf8ByteLength(input)).toBe(expected);
  });
});
