/** Fills `{name}` placeholders of a line of copy. Kept apart from the schema so a client scene never ships zod. */
export const fill = (template: string, values: Readonly<Record<string, string | number>>): string =>
  Object.entries(values).reduce((line, [key, value]) => line.replaceAll(`{${key}}`, String(value)), template);
