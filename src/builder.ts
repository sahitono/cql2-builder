import type { BBox, Geometry } from "geojson"

/** A JSON-compatible primitive. */
export type JsonPrimitive = string | number | boolean | null

/** A recursively JSON-compatible value. */
export type JsonValue = JsonPrimitive | readonly JsonValue[] | {
  readonly [key: string]: JsonValue
}

/** An OGC CQL2 JSON operation or function call. */
export interface CqlNode {
  op: string
  args: CqlArg[]
}

/** A CQL2 property reference, e.g. `{ property: 'population' }`. */
export interface CqlProperty {
  property: string
}

/** A CQL2 date literal in `YYYY-MM-DD` format. */
export interface CqlDate {
  date: string
}

/** A CQL2 UTC timestamp literal. */
export interface CqlTimestamp {
  timestamp: string
}

/** A CQL2 bounding-box literal (four or six ordinates). */
export interface CqlBBox {
  bbox: BBox
}

/** A valid interval endpoint: ISO date/timestamp, `..`, property, or function. */
export type CqlTemporalEndpoint = string | CqlProperty | Expr<string>

/** A CQL2 interval literal, including potentially unbounded endpoints. */
export interface CqlInterval {
  interval: [CqlTemporalEndpoint, CqlTemporalEndpoint]
}

/** An operand accepted by the builder's untyped extension methods. */
export type CqlArg
  = | JsonPrimitive
    | readonly CqlArg[]
    | CqlNode
    | CqlProperty
    | CqlDate
    | CqlTimestamp
    | CqlInterval
    | CqlBBox
    | Geometry
    | { readonly [key: string]: JsonValue }

/**
 * A typed CQL2 expression. `V` exists only at compile time and is never
 * serialized into the resulting JSON.
 */
export type Expr<V = unknown> = CqlNode & { readonly __valueType?: V }

/**
 * A typed property reference. `V` is a compile-time-only type parameter.
 */
export type Ref<V = unknown> = CqlProperty & { readonly __valueType?: V }

/** A CQL2 expression that evaluates to a boolean. */
export type Predicate = Expr<boolean>

export type ComparisonOp = "=" | "<>"
export type OrderOp = ">" | ">=" | "<" | "<="
export type SpatialOp
  = | "s_intersects"
    | "s_contains"
    | "s_crosses"
    | "s_disjoint"
    | "s_equals"
    | "s_overlaps"
    | "s_touches"
    | "s_within"
export type TemporalOp
  = | "t_after"
    | "t_before"
    | "t_contains"
    | "t_disjoint"
    | "t_during"
    | "t_equals"
    | "t_finishedBy"
    | "t_finishes"
    | "t_intersects"
    | "t_meets"
    | "t_metBy"
    | "t_overlappedBy"
    | "t_overlaps"
    | "t_startedBy"
    | "t_starts"
export type ArrayOp = "a_equals" | "a_contains" | "a_containedBy" | "a_overlaps"

type Field<T> = Extract<keyof T, string>
type NonNull<T> = NonNullable<T>
type Scalar = string | number | boolean
type Ordered = string | number
type KeysOf<T, V> = {
  [K in Field<T>]-?: NonNull<T[K]> extends V ? K : never
}[Field<T>]
type ScalarKeys<T> = KeysOf<T, Scalar>
type OrderedKeys<T> = KeysOf<T, Ordered>
type SpatialKeys<T> = KeysOf<T, Geometry>
type TemporalKeys<T> = KeysOf<T, string | Date | CqlDate | CqlTimestamp | CqlInterval>
type ArrayKeys<T> = KeysOf<T, readonly JsonPrimitive[]>
type ArrayElement<T> = T extends readonly (infer V)[] ? Extract<NonNull<V>, JsonPrimitive> : never

type Operand<V> = V | Ref<V> | Expr<V>
type SpatialValue = Geometry | CqlBBox | Ref<Geometry> | Expr<Geometry>
type TemporalType = string | Date | CqlDate | CqlTimestamp | CqlInterval
type TemporalValue = CqlDate | CqlTimestamp | CqlInterval | Ref<TemporalType> | Expr<TemporalType>

/**
 * Callable, schema-aware builder for OGC CQL2 JSON (OGC 21-065r2).
 *
 * `T` describes the queryable properties exposed by the server, not
 * necessarily the complete GeoJSON feature type.
 *
 * @example
 * ```ts
 * type Feature = { population: number; status: 'active' | 'inactive' }
 * const q = cql<Feature>()
 * const filter = q.and(
 *   q('population', '>', 10_000),
 *   q('status', '=', 'active'),
 * )
 * console.log(q.stringify(filter))
 * ```
 */
export interface CqlBuilder<T extends object> {
  /** Compare scalar queryables for equality or inequality. */
  <K extends ScalarKeys<T>>(
    field: K,
    op: ComparisonOp,
    value: Operand<NonNull<T[K]>>,
  ): Predicate

  /** Compare numeric or string queryables using an ordering operator. */
  <K extends OrderedKeys<T>>(
    field: K,
    op: OrderOp,
    value: Operand<NonNull<T[K]>>,
  ): Predicate

  /** Apply a standard spatial predicate to a geometry queryable. */
  <K extends SpatialKeys<T>>(
    field: K,
    op: SpatialOp,
    value: SpatialValue,
  ): Predicate

  /**
   * Apply a temporal predicate to a string/date-valued queryable.
   * TypeScript cannot distinguish ordinary strings from date strings;
   * the server remains responsible for checking temporal semantics.
   */
  <K extends TemporalKeys<T>>(
    field: K,
    op: TemporalOp,
    value: TemporalValue,
  ): Predicate

  /** Apply a set-based CQL2 array predicate to an array queryable. */
  <K extends ArrayKeys<T>>(
    field: K,
    op: ArrayOp,
    value: readonly ArrayElement<NonNull<T[K]>>[],
  ): Predicate

  /** Compare a typed property or expression for equality. */
  <V extends Scalar>(
    left: Ref<V> | Expr<V>,
    op: ComparisonOp,
    right: Operand<NoInfer<V>>,
  ): Predicate

  /** Compare an ordered typed property or expression. */
  <V extends Ordered>(
    left: Ref<V> | Expr<V>,
    op: OrderOp,
    right: Operand<NoInfer<V>>,
  ): Predicate

  /** Apply a spatial predicate to a geometry reference or expression. */
  (
    left: Ref<Geometry> | Expr<Geometry>,
    op: SpatialOp,
    right: SpatialValue,
  ): Predicate

  /**
   * Build an arbitrary CQL2 operation without operator or operand validation.
   * Explicitly provide `<boolean>` when using the result as a predicate.
   *
   * @example `q.expr<boolean>('custom_predicate', q.prop('name'), 'abc')`
   */
  expr: <V = unknown>(op: string, ...args: CqlArg[]) => Expr<V>

  /** Reference a queryable by name, retaining its TypeScript value type. */
  prop: <K extends Field<T>>(name: K) => Ref<NonNull<T[K]>>

  /** Reference a property that is not declared in `T`. */
  rawProp: (name: string) => Ref<unknown>

  /**
   * Invoke a server-supported CQL2 function.
   * The type parameter specifies the expected return type, not a runtime check.
   *
   * @example `q(q.fn<number>('length', q.prop('name')), '>', 5)`
   */
  fun: <V = unknown>(name: string, ...args: CqlArg[]) => Expr<V>

  /** Combine predicates with AND. Requires at least one predicate. */
  and: (...predicates: Predicate[]) => Predicate

  /** Combine predicates with OR. Requires at least one predicate. */
  or: (...predicates: Predicate[]) => Predicate

  /** Negate a predicate. */
  not: (predicate: Predicate) => Predicate

  /**
   * Create a CQL2 bounding-box literal from a GeoJSON bbox.
   * Throws if any coordinate is NaN or infinite. Does not validate CRS or bounds.
   */
  bbox: (coords: BBox) => CqlBBox

  /** Create a CQL2 date literal; caller supplies a valid `YYYY-MM-DD` string. */
  date: (value: string) => CqlDate

  /** Create a CQL2 timestamp literal; caller supplies an ISO 8601 UTC timestamp. */
  timestamp: (value: string) => CqlTimestamp

  /**
   * Create a temporal interval. Use `'..'` for an unbounded endpoint.
   * Pass date/timestamp strings directly, not `q.date()` or `q.timestamp()`.
   *
   * @example `q.interval('2026-01-01', '..')`
   */
  interval: (start: CqlTemporalEndpoint, end: CqlTemporalEndpoint) => CqlInterval

  /** Return the already-JSON-compatible predicate without copying it. */
  toJSON: (predicate: Predicate) => Predicate

  /** Serialize a predicate to CQL2 JSON; `space` controls indentation. */
  stringify: (predicate: Predicate, space?: number) => string
}

/**
 * Create a functional, stateless CQL2 JSON builder for queryables of type `T`.
 * No server capability checks or complete CQL2 validation are performed.
 *
 * @see https://docs.ogc.org/is/21-065r2/21-065r2.html
 */
export function cql<T extends object>(): CqlBuilder<T> {
  const operation = <V>(op: string, ...args: CqlArg[]): Expr<V> => ({ op, args })
  const property = <V>(name: string): Ref<V> => ({ property: name })

  // The overloads live in CqlBuilder<T>; the runtime implementation is shared.
  const compare = (
    left: string | CqlArg,
    op: ComparisonOp | OrderOp | SpatialOp | TemporalOp | ArrayOp,
    right: CqlArg,
  ): Predicate => operation<boolean>(
    op,
    typeof left === "string" ? property(left) : left,
    right,
  )

  function logical(op: "and" | "or", predicates: Predicate[]): Predicate {
    if (predicates.length === 0) {
      throw new Error(`${op} requires at least one predicate`)
    }
    return predicates.length === 1 ? predicates[0]! : operation<boolean>(op, ...predicates)
  }

  return Object.assign(compare, {
    expr: operation,
    fun: operation,
    prop: <K extends Field<T>>(name: K) => property<NonNull<T[K]>>(name),
    rawProp: (name: string) => property<unknown>(name),
    and: (...predicates: Predicate[]) => logical("and", predicates),
    or: (...predicates: Predicate[]) => logical("or", predicates),
    not: (predicate: Predicate) => operation<boolean>("not", predicate),
    bbox: (coords: BBox): CqlBBox => {
      if (coords.some(value => !Number.isFinite(value))) {
        throw new Error("BBOX coordinates must be finite numbers")
      }
      return { bbox: [...coords] as BBox }
    },
    date: (value: string): CqlDate => ({ date: value }),
    timestamp: (value: string): CqlTimestamp => ({ timestamp: value }),
    interval: (start: CqlTemporalEndpoint, end: CqlTemporalEndpoint): CqlInterval => ({
      interval: [start, end],
    }),
    toJSON: (predicate: Predicate) => predicate,
    stringify: (predicate: Predicate, space?: number) => JSON.stringify(predicate, null, space),
  }) as CqlBuilder<T>
}
