/**
 * Pure helpers for working with DHIS2 `fields` parameter strings.
 *
 * DHIS2 field selectors are comma-separated lists that may contain nested
 * selectors in square brackets, e.g. `id,displayName,categoryCombo[id,name]`.
 * These helpers live in `domain/` because they are used by both use cases
 * (building queries) and by presentation code (building table columns), and
 * they do not depend on any runtime or framework.
 */

/**
 * Tokenizes a DHIS2 `fields` string into its top-level entries, respecting
 * nesting. Whitespace around each token is trimmed and empty tokens are
 * discarded.
 *
 * @example splitTopLevelFields("id, categoryCombo[id, categories[id]]")
 *   => ["id", "categoryCombo[id, categories[id]]"]
 */
export function splitTopLevelFields(value: string): string[] {
    type State = { tokens: string[]; current: string; depth: number };

    const finalState = Array.from(value).reduce<State>(
        (state, char) => {
            if (char === "[") {
                return { ...state, current: state.current + char, depth: state.depth + 1 };
            }
            if (char === "]") {
                return {
                    ...state,
                    current: state.current + char,
                    depth: Math.max(0, state.depth - 1),
                };
            }
            if (char === "," && state.depth === 0) {
                const trimmed = state.current.trim();
                return {
                    ...state,
                    tokens: trimmed ? [...state.tokens, trimmed] : state.tokens,
                    current: "",
                };
            }
            return { ...state, current: state.current + char };
        },
        { tokens: [], current: "", depth: 0 }
    );

    const lastToken = finalState.current.trim();
    return lastToken ? [...finalState.tokens, lastToken] : finalState.tokens;
}

/**
 * Returns the top-level field name from a single token, stripping any
 * nested selector in brackets. `getTopLevelFieldName("cc[id]")` -> `"cc"`.
 */
export function getTopLevelFieldName(token: string): string {
    const trimmed = token.trim();
    if (!trimmed) return "";
    const bracketIndex = trimmed.indexOf("[");
    return (bracketIndex === -1 ? trimmed : trimmed.slice(0, bracketIndex)).trim();
}

/**
 * Ensures every field in `required` is present as a top-level field in
 * `fields`. Missing fields are prepended in the order they appear in
 * `required`.
 */
export function ensureFields(fields: string, required: ReadonlyArray<string>): string {
    return required.reduceRight((acc, field) => ensureField(acc, field), fields);
}

function ensureField(fields: string, field: string): string {
    const present = splitTopLevelFields(fields).some(
        token => getTopLevelFieldName(token) === field
    );
    if (present) return fields;
    return fields.length > 0 ? `${field},${fields}` : field;
}
