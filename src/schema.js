// Tiny JSON Schema checker (the subset the starter tasks use). Plain code, no AI.
// Returns a list of problems; empty list = valid.
export function checkSchema(value, schema, path = '$') {
  if (!schema) return [];
  const errs = [];
  const t = schema.type;
  const typeOk = {
    object: (v) => v !== null && typeof v === 'object' && !Array.isArray(v),
    array: Array.isArray,
    string: (v) => typeof v === 'string',
    integer: Number.isInteger,
    number: (v) => typeof v === 'number' && Number.isFinite(v),
    boolean: (v) => typeof v === 'boolean',
  };
  if (t && typeOk[t] && !typeOk[t](value)) return [`${path} should be ${t}`];
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${path} not in [${schema.enum.join(', ')}]`);
  if (typeof value === 'number') {
    if (schema.minimum !== undefined && value < schema.minimum) errs.push(`${path} < ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errs.push(`${path} > ${schema.maximum}`);
  }
  if (t === 'object') {
    for (const k of schema.required || []) {
      if (!(k in value) || value[k] === '' || value[k] === null) errs.push(`${path}.${k} missing`);
    }
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (k in value && value[k] !== null) errs.push(...checkSchema(value[k], sub, `${path}.${k}`));
    }
  }
  if (t === 'array' && schema.items) value.forEach((v, i) => errs.push(...checkSchema(v, schema.items, `${path}[${i}]`)));
  return errs;
}
