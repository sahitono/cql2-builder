import type { Geometry } from "geojson"
import { describe, expect, it } from "vitest"
import { cql } from "../src/"

interface Feature {
  population: number
  status: "active" | "inactive"
  tags: string[]
  geometry: Geometry | null
  createdAt: string
}

const q = cql<Feature>()

describe("cQL2 JSON builder", () => {
  it("composes comparisons and logical predicates", () => {
    const filter = q.and(
      q("population", ">", 10_000),
      q.or(q("status", "=", "active"), q("status", "=", "inactive")),
    )

    expect(filter).toEqual({
      op: "and",
      args: [
        {
          op: ">",
          args: [{ property: "population" }, 10_000],
        },
        {
          op: "or",
          args: [
            {
              op: "=",
              args: [{ property: "status" }, "active"],
            },
            {
              op: "=",
              args: [{ property: "status" }, "inactive"],
            },
          ],
        },
      ],
    })
    expect(JSON.parse(q.stringify(filter))).toEqual(filter)
  })

  it("creates spatial, temporal, and array predicates", () => {
    expect(q("geometry", "s_intersects", q.bbox([0, 0, 1, 1]))).toEqual({
      op: "s_intersects",
      args: [{ property: "geometry" }, { bbox: [0, 0, 1, 1] }],
    })
    expect(q("createdAt", "t_during", q.interval("2026-01-01", ".."))).toEqual({
      op: "t_during",
      args: [{ property: "createdAt" }, { interval: ["2026-01-01", ".."] }],
    })
    expect(q("tags", "a_containedBy", ["foo"])).toEqual({
      op: "a_containedBy",
      args: [{ property: "tags" }, ["foo"]],
    })
  })

  it("creates typed function expressions without adding metadata to JSON", () => {
    expect(q(q.fun<number>("length", q.prop("status")), ">", 3)).toEqual({
      op: ">",
      args: [{
        op: "length",
        args: [{ property: "status" }],
      }, 3],
    })
  })

  it("rejects empty logical groups and non-finite bbox coordinates", () => {
    expect(() => q.and()).toThrow("and requires at least one predicate")
    expect(() => q.or()).toThrow("or requires at least one predicate")
    expect(() => q.bbox([0, 0, Infinity, 1])).toThrow("BBOX coordinates must be finite numbers")
  })

  it("leaves a one-element logical group unchanged", () => {
    const filter = q("status", "=", "active")
    expect(q.and(filter)).toBe(filter)
    expect(q.or(filter)).toBe(filter)
  })
})
