import type { Predicate } from "./builder"
import { parseJSON } from "cql2-filters-parser"

export function toText(filter: Predicate) {
  return parseJSON(filter).toText()
}
