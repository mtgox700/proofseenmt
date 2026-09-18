import { BRIEF_PLACEHOLDER, JD_PLACEHOLDER, type PromptTemplate } from "./schemas";

export interface PromptInput {
  /** Job description already passed through sanitizeJobDescription. */
  readonly jd: string;
  readonly brief?: string | undefined;
}

/**
 * Builds the recruiter-style prompt. The input type carries no identity on purpose:
 * the client's name can never reach an engine (REQ-M1-08).
 */
export const renderPrompt = (template: PromptTemplate, input: PromptInput): string => {
  if (template.text.includes(BRIEF_PLACEHOLDER) && input.brief === undefined) {
    throw new Error(`template ${template.id} needs a brief`);
  }
  return template.text.split(JD_PLACEHOLDER).join(input.jd).split(BRIEF_PLACEHOLDER).join(input.brief ?? "");
};
