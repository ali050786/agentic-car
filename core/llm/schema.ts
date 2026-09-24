/**
 * A small JSON-Schema subset validator + coercer for model output.
 *
 * Agents have always passed a response schema to generateContent, but it was
 * never checked, so shape errors surfaced later as silent fallbacks ("0 slides",
 * "shape mismatch, skipping"). This validates the parts of JSON Schema the
 * agents actually use (type, properties, required, items, enum, min/maxItems),
 * coerces harmless drift in place, and returns the errors that matter so the
 * caller can ask the model to repair its answer once.
 *
 * Coercions (never reported as errors):
 *  - "12" → 12 for number/integer fields, 12 → "12" for string fields
 *  - a single object where an array is expected → [object]
 *  - a lone string/number where an array is expected → [value] (newline lists split)
 *  - a small text object where a string is expected → "key: detail"
 *    ({"bullet": "Docs", "description": "write it down"} → "Docs: write it down"),
 *    so a common model habit costs no repair round trip
 *  - an optional string whose value is outside its enum → field removed
 *    (downstream defaults apply; e.g. an icon name the model invented)
 */

export interface JsonSchema {
    type?: string | string[];
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    enum?: unknown[];
    minItems?: number;
    maxItems?: number;
    description?: string;
}

const typeOf = (v: unknown): string => {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    if (typeof v === 'number') return Number.isInteger(v) ? 'integer' : 'number';
    return typeof v;
};

/** {"title"/"bullet"/…: key, "description"/"text"/…: detail} → "key: detail"; null if it isn't that shape. */
const textOfObject = (o: Record<string, unknown>): string | null => {
    const str = (x: unknown) => (typeof x === 'string' || typeof x === 'number' ? String(x).trim() : '');
    const keys = Object.keys(o);
    if (!keys.length || keys.length > 4 || Object.values(o).some((x) => x !== null && typeof x === 'object')) return null;
    const key = str(o.bullet ?? o.title ?? o.key ?? o.label ?? o.name ?? o.heading);
    const detail = str(o.description ?? o.detail ?? o.value ?? o.text ?? o.body ?? o.content);
    const joined = key && detail ? `${key}: ${detail}` : key || detail;
    return joined || null;
};

const matches = (expected: string, actual: string) =>
    expected === actual || (expected === 'number' && actual === 'integer');

/**
 * Validates `value` against `schema`, coercing in place where safe.
 * Returns the (possibly replaced) value and a list of human-readable errors.
 */
export const validateAndCoerce = (
    value: any,
    schema: JsonSchema | undefined,
    path = '$',
): { value: any; errors: string[] } => {
    const errors: string[] = [];
    if (!schema || typeof schema !== 'object') return { value, errors };

    const expected = Array.isArray(schema.type) ? schema.type : schema.type ? [schema.type] : [];
    let v = value;

    if (expected.length) {
        let actual = typeOf(v);
        if (!expected.some((t) => matches(t, actual))) {
            // Safe coercions first.
            if (expected.some((t) => t === 'number' || t === 'integer') && typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) {
                v = Number(v);
            } else if (expected.includes('string') && (typeof v === 'number' || typeof v === 'boolean')) {
                v = String(v);
            } else if (expected.includes('string') && actual === 'object' && textOfObject(v) !== null) {
                v = textOfObject(v);
            } else if (expected.includes('array') && actual === 'object') {
                v = [v];
            } else if (expected.includes('array') && (actual === 'string' || actual === 'number')) {
                // A lone scalar where a list is expected: "a\nb\nc" → 3 items, "a" → ["a"].
                v = typeof v === 'string' && v.includes('\n') ? v.split('\n').map((x: string) => x.replace(/^\s*(?:[-•*]|\d+[.)])\s+/, '').trim()).filter(Boolean) : [v];
            } else if (expected.includes('boolean') && (v === 'true' || v === 'false')) {
                v = v === 'true';
            } else {
                errors.push(`${path}: expected ${expected.join('|')}, got ${actual}`);
                return { value: v, errors };
            }
            actual = typeOf(v);
        }
    }

    if (schema.enum && !schema.enum.includes(v)) {
        errors.push(`${path}: "${String(v).slice(0, 40)}" is not one of ${schema.enum.slice(0, 12).join(', ')}${schema.enum.length > 12 ? ', …' : ''}`);
    }

    if (typeOf(v) === 'object' && schema.properties) {
        for (const key of schema.required || []) {
            if (v[key] === undefined || v[key] === null) errors.push(`${path}.${key}: required`);
        }
        for (const [key, sub] of Object.entries(schema.properties)) {
            if (v[key] === undefined || v[key] === null) continue;
            const r = validateAndCoerce(v[key], sub, `${path}.${key}`);
            v[key] = r.value;
            const isRequired = (schema.required || []).includes(key);
            // Optional enum drift: drop the field instead of failing the call.
            const enumOnly = r.errors.length > 0 && r.errors.every((e) => e.includes('is not one of'));
            if (!isRequired && enumOnly && sub.enum) {
                delete v[key];
                continue;
            }
            errors.push(...r.errors);
        }
    }

    if (Array.isArray(v) && schema.items) {
        const kept: any[] = [];
        v.forEach((item, i) => {
            const r = validateAndCoerce(item, schema.items, `${path}[${i}]`);
            // Drop array items whose only problem is an enum mismatch on a scalar
            // (e.g. one bad icon name in a list) rather than failing the whole call.
            const enumOnly = r.errors.length > 0 && r.errors.every((e) => e.includes('is not one of')) && typeOf(item) !== 'object';
            if (enumOnly) return;
            kept.push(r.value);
            errors.push(...r.errors);
        });
        v = kept;
        if (typeof schema.minItems === 'number' && v.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems} items, got ${v.length}`);
        if (typeof schema.maxItems === 'number' && v.length > schema.maxItems) v = v.slice(0, schema.maxItems);
    }

    return { value: v, errors };
};

/** Some models wrap the whole answer in {"data": …}/{"result": …}. Unwrap when the schema's required keys live one level down. */
export const unwrapEnvelope = (value: any, schema?: JsonSchema): any => {
    if (!schema?.required?.length || !value || typeof value !== 'object' || Array.isArray(value)) return value;
    const hasRequired = schema.required.some((k) => k in value);
    if (hasRequired) return value;
    const keys = Object.keys(value);
    if (keys.length === 1 && value[keys[0]] && typeof value[keys[0]] === 'object') {
        const inner = value[keys[0]];
        if (schema.required.some((k) => k in inner)) return inner;
    }
    return value;
};

/** Compact one-line description of a schema for repair prompts. */
export const describeSchema = (schema: JsonSchema | undefined, depth = 0): string => {
    if (!schema || depth > 4) return 'any';
    const t = Array.isArray(schema.type) ? schema.type.join('|') : schema.type || 'any';
    if (schema.enum) return `one of [${schema.enum.slice(0, 10).join(', ')}]`;
    if (t === 'array') return `array of ${describeSchema(schema.items, depth + 1)}`;
    if (t === 'object' && schema.properties) {
        const req = new Set(schema.required || []);
        const fields = Object.entries(schema.properties)
            .map(([k, s]) => `${k}${req.has(k) ? '' : '?'}: ${describeSchema(s, depth + 1)}`)
            .join(', ');
        return `{ ${fields} }`;
    }
    return t;
};
