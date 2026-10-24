import { describe, expect, it } from "vitest";
import { dateFr, dur, fcfa } from "../lib.js";

describe("formatters", () => {
  it("formate les prix en FCFA", () => {
    expect(fcfa(0)).toBe("Gratuit");
    expect(fcfa(15000)).toContain("15");
    expect(fcfa(15000)).toContain("FCFA");
  });

  it("formate les durées", () => {
    expect(dur(45)).toBe("45 min");
    expect(dur(90)).toBe("1 h 30");
  });

  it("formate les dates en français", () => {
    expect(dateFr("2026-01-15")).toContain("janvier");
    expect(dateFr("2026-01-15")).toContain("2026");
  });
});
