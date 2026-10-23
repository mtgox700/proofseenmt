import type { ReactNode } from "react";
import { prerenderToNodeStream } from "react-dom/static";

/**
 * The HTML of a tree that holds async server components (a page whose sections read the database themselves), as the
 * server would send it once everything has resolved. `renderToStaticMarkup` refuses those: it cannot wait.
 */
export const renderAsync = async (node: ReactNode): Promise<string> => {
  const { prelude } = await prerenderToNodeStream(node);
  const chunks: Buffer[] = [];
  for await (const chunk of prelude) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  return Buffer.concat(chunks).toString("utf8");
};
