/** Deep clone via JSON — editor data is plain. */
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
