import { describe, expect, it } from "vitest";
import { sortTablesBySeats, validSeats } from "./tableSeats";

describe("table capacity", () => {
  it("only accepts positive whole seat counts within the supported range", () => {
    for (const value of ["", "0", "-1", "1.5", "1000", "abc"]) expect(validSeats(value)).toBe(false);
    for (const value of ["1", "4", "999"]) expect(validSeats(value)).toBe(true);
  });
  it("sorts seats ascending, names naturally, and unknown capacity last", () => {
    const tables = [{ name: "Bàn 1", seats: null }, { name: "Bàn 10", seats: 4 }, { name: "Bàn 2", seats: 4 }, { name: "Bàn 8", seats: 2 }];
    expect(sortTablesBySeats(tables).map(t => t.name)).toEqual(["Bàn 8", "Bàn 2", "Bàn 10", "Bàn 1"]);
    expect(tables[0].seats).toBe(null);
  });
});