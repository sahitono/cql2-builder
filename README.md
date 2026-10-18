# CQL2 Builder

A lightweight, type-safe TypeScript builder for [OGC CQL2 JSON](https://docs.ogc.org/is/21-065r2/21-065r2.html).

Build CQL2 expressions with type-safe property references, operators, and values. The output is plain JSON, ready to use with compatible OGC APIs.

- Zero runtime dependencies
- Type-safe, schema-aware API
- Supports spatial, temporal, and array predicates
- Extensible with custom functions and operators

## Development

Built using conventions from [antfu/starter-ts](https://github.com/antfu/starter-ts), with tsdown, Vitest, and ESLint.

```bash
corepack enable
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## Usage

```ts
import { cql } from 'cql2-builder'
import type { Geometry } from 'geojson'

interface Feature {
  population: number
  status: 'active' | 'inactive'
  category: string
  geometry: Geometry
}

const q = cql<Feature>()

const filter = q.and(
  q('population', '>', 10000),
  q('status', '=', 'active'),
  q.or(
    q('category', '=', 'residential'),
    q('category', '=', 'commercial'),
  ),
  q('geometry', 's_intersects', q.bbox([110, -7, 111, -6])),
)

console.log(q.stringify(filter, 2))
```

The builder returns a JSON-serializable CQL2 expression. No additional transformation is required.

## API

| Category | API |
|---|---|
| Comparison | `=`, `<>`, `>`, `>=`, `<`, `<=` |
| Logical | `and`, `or`, `not` |
| Spatial | `s_intersects`, `s_within`, `s_contains`, etc. |
| Temporal | `t_before`, `t_after`, `t_intersects`, etc. |
| Array | `a_equals`, `a_contains`, `a_containedBy`, `a_overlaps` |
| References | `prop`, `rawProp` |
| Literals | `bbox`, `date`, `timestamp`, `interval` |
| Extensions | `fun`, `expr` |
| Serialization | `toJSON`, `stringify` |

### Spatial and temporal predicates

```ts
q('geometry', 's_within', {
  type: 'Point',
  coordinates: [110, -7],
})

q('createdAt', 't_before', q.timestamp('2026-10-18T00:00:00Z'))

q('createdAt', 't_intersects',
  q.interval('2026-01-01', '2026-02-01'),
)
```

Temporal examples assume `createdAt` is declared as a string queryable in the feature interface.

### Custom functions and operators

```ts
// Server-defined function
q(q.fun<number>('AREA', q.prop('geometry')), '>', 1000)

// Custom predicate
q.expr<boolean>('custom_operator', q.prop('status'), 'active')
```

Custom expressions are not validated against server capabilities.

## API integration

The resulting expression can be sent directly to an API that accepts CQL2 JSON.

```ts
await fetch('/api/features/search', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    filter,
    'filter-lang': 'cql2-json',
  }),
})
```

## Scope

The builder provides compile-time type checking for property names, operators, and common value types. It does not perform runtime schema validation.

It does not parse CQL2 Text, evaluate filters, generate SQL, or verify server conformance.

Support for optional operators and custom functions depends on the receiving server.

## Reference

[OGC Common Query Language (CQL2) — 21-065r2](https://docs.ogc.org/is/21-065r2/21-065r2.html)
