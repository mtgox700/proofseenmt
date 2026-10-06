import { cache } from "react";
import { getSource } from "./file-source";
import { DEMO_REFERENCE } from "./source";
import type { FreelanceWorkspace } from "./schema";

/** One read per request, shared by the layout and the page that both need the workspace. */
export const loadDemoWorkspace = cache(async (): Promise<FreelanceWorkspace | null> => getSource().freelance(DEMO_REFERENCE));
