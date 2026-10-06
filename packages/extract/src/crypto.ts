import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export interface SealedPayload {
  readonly iv: string;
  readonly tag: string;
  readonly data: string;
}

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

/** Reads PROOFSEEN_ENC_KEY (base64, 32 bytes). Never logs the value. */
export const parseKey = (base64: string | undefined): Buffer => {
  if (base64 === undefined || base64.trim() === "") {
    throw new Error("PROOFSEEN_ENC_KEY is missing (see .env.example)");
  }
  const key = Buffer.from(base64.trim(), "base64");
  if (key.length !== 32) throw new Error("PROOFSEEN_ENC_KEY must decode to exactly 32 bytes");
  return key;
};

export const encrypt = (plaintext: string, key: Buffer): SealedPayload => {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const data = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64"), data: data.toString("base64") };
};

export const decrypt = (payload: SealedPayload, key: Buffer): string => {
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(payload.data, "base64")), decipher.final()]).toString("utf8");
};
