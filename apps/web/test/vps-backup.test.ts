import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";

// Each script plays dozens of short processes (fork cost: seconds on a loaded Windows machine, milliseconds on the VPS).
vi.setConfig({ testTimeout: 900_000 });

/*
 * The nightly backup of the database AND of the uploads volume (deploy/vps/backup.sh), the restore check
 * (restore-check.sh) and the verifier they share (uploads-verify.sh). Nothing here touches Docker or a server: the scripts
 * are read, syntax-checked, and played on a temporary folder with a fake `docker` that stands in for the containers.
 * Skipped where no POSIX shell with tar, sha256sum and awk is found.
 */

const VPS = join(__dirname, "..", "..", "..", "deploy", "vps");
const script = (name: string): string => readFileSync(join(VPS, name), "utf8");

const sh = (args: readonly string[], options: { readonly env?: NodeJS.ProcessEnv; readonly input?: Buffer; readonly cwd?: string } = {}): SpawnSyncReturns<Buffer> =>
  spawnSync("sh", [...args], { env: options.env ?? process.env, input: options.input, cwd: options.cwd, maxBuffer: 64 * 1024 * 1024 });

const toolsOk = ((): boolean => {
  try {
    return sh(["-c", "command -v tar sha256sum awk find gzip mktemp seq head cut wc tr sort >/dev/null"]).status === 0;
  } catch {
    return false;
  }
})();
const shell = toolsOk ? describe : describe.skip;

const scratch: string[] = [];
const temp = (): string => {
  const dir = mkdtempSync(join(tmpdir(), "proofseen-vps-test-"));
  scratch.push(dir);
  return dir;
};
afterAll(() => {
  for (const dir of scratch) rmSync(dir, { recursive: true, force: true });
});

const text = (result: SpawnSyncReturns<Buffer>): string => `${result.stdout.toString()}${result.stderr.toString()}`;

/** A volume tree as the application writes it: <first two characters>/<uuid>. */
const IDS = ["0a1b2c3d-0000-4000-8000-000000000001", "0a9f0000-0000-4000-8000-000000000002", "7e2d0000-0000-4000-8000-000000000003", "ffee0000-0000-4000-8000-000000000004"];
const volume = (): string => {
  const root = temp();
  for (const id of IDS) {
    mkdirSync(join(root, id.slice(0, 2)), { recursive: true });
    writeFileSync(join(root, id.slice(0, 2), id), `contenu de ${id}\n`.repeat(40));
  }
  // A half-written upload: never archived.
  writeFileSync(join(root, "0a", `${IDS[0]}.11111111-1111-4111-8111-111111111111.part`), "partial");
  return root;
};

const archiveOf = (root: string): Buffer => {
  const result = sh(["-c", `tar czf - --exclude='*.part' -C '${root.replace(/\\/g, "/")}' .`]);
  if (result.status !== 0) throw new Error(text(result));
  return result.stdout;
};

const posix = (path: string): string => path.replace(/\\/g, "/");

describe("scripts read as written", () => {
  it("each script is valid POSIX shell", () => {
    if (!toolsOk) return;
    for (const name of ["backup.sh", "restore-check.sh", "uploads-verify.sh"]) {
      const result = sh(["-n", posix(join(VPS, name))]);
      expect(result.status, `${name}: ${text(result)}`).toBe(0);
    }
  });

  it("backup.sh: one timestamp, the database before the volume, the volume read-only, root-only files, one rotation for all three kinds", () => {
    const backup = script("backup.sh");
    expect(backup.match(/^stamp=\$\(date/gm)).toHaveLength(1);
    for (const name of ["name", "uploads", "manifest"]) expect(backup).toMatch(new RegExp(`^${name}="proofseen-\\$stamp\\.`, "m"));
    expect(backup).toContain("umask 077");
    expect(backup).toContain("chmod 700");
    expect(backup.indexOf("pg_dump --format=custom")).toBeLessThan(backup.indexOf("tar czf -"));
    expect(backup).toContain('-v "$volume":/data:ro');
    expect(backup).toContain("--exclude='*.part'");
    expect(backup).toMatch(/-name 'proofseen-\*\.dump' -o -name 'proofseen-\*\.uploads\.tar\.gz' -o -name 'proofseen-\*\.uploads\.sha256'/);
    expect(backup).toContain('-mtime +"$((BACKUP_DAYS - 1))"');
    // Nothing secret reaches a log: the URL is passed through the environment and never echoed, no tracing.
    expect(backup).not.toMatch(/echo[^\n]*\$url/);
    expect(backup).not.toMatch(/^set -[a-z]*x/m);
  });

  it("restore-check.sh restores the volume without a network and checks the vault's files against the restored database", () => {
    const check = script("restore-check.sh");
    expect(check).toContain("--network none");
    expect(check).toContain("uploads-verify.sh");
    expect(check).toContain('"storageKey" FROM "DocumentVersion"');
    expect(check).toContain('"id" FROM "StoredFile"');
    expect(check).toContain("SAMPLE=20");
    expect(script("docker-compose.yml")).toContain("proofseen-uploads:/data/uploads");
  });
});

shell("uploads-verify.sh", () => {
  const verify = posix(join(VPS, "uploads-verify.sh"));

  const manifestOf = (archive: Buffer): string => {
    const result = sh([verify, "manifest"], { input: archive });
    expect(result.status, text(result)).toBe(0);
    return result.stdout.toString();
  };

  const check = (archive: Buffer, manifest: string, extra: { readonly documents?: string[]; readonly files?: string[]; readonly sample?: number } = {}): SpawnSyncReturns<Buffer> => {
    const dir = temp();
    writeFileSync(join(dir, "manifest"), manifest);
    writeFileSync(join(dir, "documents"), `${(extra.documents ?? []).join("\n")}\n`);
    writeFileSync(join(dir, "files"), `${(extra.files ?? []).join("\n")}\n`);
    return sh([verify, "check", posix(join(dir, "manifest")), String(extra.sample ?? 20), posix(join(dir, "documents")), posix(join(dir, "files"))], { input: archive });
  };

  it("describes every file of the archive by its SHA-256, sorted, and leaves out the half-written one", () => {
    const manifest = manifestOf(archiveOf(volume()));
    const lines = manifest.trim().split("\n");
    expect(lines).toHaveLength(IDS.length);
    expect(lines.every((line) => /^[0-9a-f]{64} {2}\.\/[0-9a-f]{2}\/[0-9a-f-]{36}$/.test(line))).toBe(true);
    // Sorted by path, so two manifests of the same volume are identical byte for byte.
    const paths = lines.map((line) => line.slice(66));
    expect(paths).toEqual([...paths].sort());
    expect(manifest).not.toContain(".part");
  });

  it("accepts an intact archive: count, sample and vault documents", () => {
    const archive = archiveOf(volume());
    const result = check(archive, manifestOf(archive), { documents: [IDS[0] ?? "", IDS[2] ?? ""], files: [IDS[1] ?? ""] });
    expect(result.status, text(result)).toBe(0);
    const out = text(result);
    expect(out).toContain("4 files restored, the count matches the manifest");
    expect(out).toContain("4 sampled files match their recorded SHA-256");
    expect(out).toContain("vault documents missing from the archive: 0");
  });

  it("samples at most SAMPLE files, spread over the manifest", () => {
    const archive = archiveOf(volume());
    const out = text(check(archive, manifestOf(archive), { sample: 2 }));
    expect(out).toContain("2 sampled files match");
  });

  it("refuses an archive with a file missing, a file altered, or a vault document without its file", () => {
    const root = volume();
    const archive = archiveOf(root);
    const manifest = manifestOf(archive);

    rmSync(join(root, "7e", IDS[2] ?? ""));
    const lost = check(archiveOf(root), manifest);
    expect(lost.status).toBe(1);
    expect(text(lost)).toContain("3 files restored, the manifest lists 4");

    const altered = volume();
    writeFileSync(join(altered, "0a", IDS[0] ?? ""), "altéré");
    const tampered = check(archiveOf(altered), manifest, { sample: 100 });
    expect(tampered.status).toBe(1);
    expect(text(tampered)).toContain("does not match its recorded SHA-256");

    const unknown = check(archive, manifest, { documents: ["abcd0000-0000-4000-8000-0000000000ff"] });
    expect(unknown.status).toBe(1);
    expect(text(unknown)).toContain("1 vault document files are missing");
  });

  it("only reports a stored file whose row has no file (an erased account), and passes an empty volume", () => {
    const archive = archiveOf(volume());
    const result = check(archive, manifestOf(archive), { files: ["abcd0000-0000-4000-8000-0000000000ff", IDS[1] ?? ""] });
    expect(result.status, text(result)).toBe(0);
    expect(text(result)).toContain("(informational): 1");

    const empty = archiveOf(temp());
    const nothing = check(empty, manifestOf(empty));
    expect(nothing.status, text(nothing)).toBe(0);
    expect(text(nothing)).toContain("empty volume");
  });

  it("refuses an unknown mode and a stream that is not an archive", () => {
    expect(sh([verify, "frobnicate"], { input: archiveOf(volume()) }).status).toBe(1);
    expect(sh([verify, "manifest"], { input: Buffer.from("pas une archive") }).status).not.toBe(0);
  });
});

/** A fake `docker` on the PATH: the containers are replaced by the host's own tools, the real scripts run unchanged. */
const FAKE_DOCKER = `#!/bin/sh
# Fake docker for tests. Behaviour is driven by FAKE_* variables.
verb=$1
shift
case "$verb" in
inspect) printf '%s' "\${FAKE_VOLUME_NAME-fake-uploads-volume}" ;;
rm) exit 0 ;;
cp) exit 0 ;;
exec)
  # exec NAME pg_isready | pg_restore | psql ...
  shift
  case "$1" in
  pg_isready | pg_restore) exit 0 ;;
  psql)
    sql=$(printf '%s\\n' "$@" | tail -1)
    case "$sql" in
    *to_regclass*) printf 'DocumentVersion\\n' ;;
    *storageKey*) cat "$FAKE_DOCUMENT_KEYS" ;;
    *'"id" FROM "StoredFile"'*) cat "$FAKE_FILE_KEYS" ;;
    *) printf '3\\n' ;;
    esac
    ;;
  esac
  ;;
run)
  keys='' manifest='' verify=''
  while [ "$#" -gt 0 ]; do
    case "$1" in
    -v)
      case "$2" in
      *:/verify.sh:ro) verify=\${2%:/verify.sh:ro} ;;
      *:/manifest:ro) manifest=\${2%:/manifest:ro} ;;
      *:/keys:ro) keys=\${2%:/keys:ro} ;;
      esac
      shift
      ;;
    -e) shift ;;
    --name | --network) shift ;;
    --rm | -i | -d) ;;
    postgres:18-alpine) shift; break ;;
    esac
    shift
  done
  case "$*" in
  "sh -c "*pg_dump*) head -c 8192 /dev/zero ;;
  "tar czf -"*) [ -z "\${FAKE_TAR_FAILS-}" ] || exit 1; exec tar czf - --exclude='*.part' -C "$FAKE_VOLUME_DIR" . ;;
  "sh /verify.sh manifest"*) exec sh "$verify" manifest ;;
  "sh /verify.sh check"*)
    shift 3
    exec sh "$verify" check "$manifest" "$2" "$keys/documents" "$keys/files"
    ;;
  esac
  ;;
esac
`;

const rig = (extra: NodeJS.ProcessEnv = {}) => {
  const root = temp();
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), FAKE_DOCKER);
  chmodSync(join(bin, "docker"), 0o755);
  const dir = join(root, "backups");
  const envFile = join(root, "env.production");
  writeFileSync(envFile, 'DATABASE_URL="postgres://user:SECRETPASSWORD@db.example.invalid:5432/proofseen"\nOTHER=1\n');
  const vol = volume();
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    PATH: `${bin}${delimiter}${process.env.PATH ?? ""}`,
    PROOFSEEN_ENV_FILE: posix(envFile),
    PROOFSEEN_BACKUP_DIR: posix(dir),
    FAKE_VOLUME_DIR: posix(vol),
    ...extra,
  };
  return { root, dir, env, vol };
};

const run = (name: string, env: NodeJS.ProcessEnv): SpawnSyncReturns<Buffer> => sh([posix(join(VPS, name))], { env });

shell("backup.sh, played on a temporary folder", () => {
  it("writes the dump, the archive and its manifest under one timestamp, and prints no secret", () => {
    const { dir, env } = rig();
    const result = run("backup.sh", env);
    expect(result.status, text(result)).toBe(0);
    const files = readdirSync(dir).sort();
    expect(files).toHaveLength(3);
    const [dump, manifest, archive] = files;
    const stamp = /^proofseen-(\d{8}-\d{4})\.dump$/.exec(dump ?? "")?.[1];
    expect(stamp).toBeDefined();
    expect(archive).toBe(`proofseen-${stamp}.uploads.tar.gz`);
    expect(manifest).toBe(`proofseen-${stamp}.uploads.sha256`);
    expect(statSync(join(dir, dump ?? "")).size).toBeGreaterThanOrEqual(4096);
    expect(readFileSync(join(dir, manifest ?? ""), "utf8").trim().split("\n")).toHaveLength(IDS.length);
    expect(text(result)).not.toContain("SECRETPASSWORD");
    expect(text(result)).toContain(`${archive}`);
    expect(text(result)).toContain(`${IDS.length} files`);
    if (process.platform !== "win32") {
      expect((statSync(dir).mode & 0o777).toString(8)).toBe("700");
      for (const file of files) expect((statSync(join(dir, file)).mode & 0o777).toString(8)).toBe("600");
    }
    expect(readdirSync(dir).filter((file) => file.startsWith("."))).toEqual([]);
  });

  it("a volume that cannot be found fails the night after the dump is kept, with no partial file", () => {
    const { dir, env } = rig({ FAKE_VOLUME_NAME: "" });
    const result = run("backup.sh", env);
    expect(result.status).toBe(1);
    expect(text(result)).toContain("uploads volume not found");
    expect(readdirSync(dir).filter((file) => file.endsWith(".dump"))).toHaveLength(1);
    expect(readdirSync(dir).filter((file) => file.includes("uploads"))).toEqual([]);
  });

  it("an archive that fails leaves no piece behind, keeps the dump, and still rotates", () => {
    const { dir, env } = rig({ FAKE_TAR_FAILS: "1" });
    mkdirSync(dir, { recursive: true });
    const old = join(dir, "proofseen-20200101-0300.dump");
    writeFileSync(old, "ancien");
    const longAgo = new Date(Date.now() - 20 * 24 * 3600 * 1000);
    utimesSync(old, longAgo, longAgo);
    const result = run("backup.sh", env);
    expect(result.status).toBe(1);
    expect(text(result)).toContain("uploads archive failed");
    expect(existsSync(old)).toBe(false);
    expect(readdirSync(dir).filter((file) => file.includes("uploads") || file.startsWith("."))).toEqual([]);
    expect(readdirSync(dir).filter((file) => file.endsWith(".dump"))).toHaveLength(1);
  });

  it("rotates the three kinds of file together: older than 14 days goes, newer stays", () => {
    const { dir, env } = rig();
    mkdirSync(dir, { recursive: true });
    const ancient = ["proofseen-20200101-0300.dump", "proofseen-20200101-0300.uploads.tar.gz", "proofseen-20200101-0300.uploads.sha256"].map((name) => join(dir, name));
    const recent = ["proofseen-20261020-0300.dump", "proofseen-20261020-0300.uploads.tar.gz", "proofseen-20261020-0300.uploads.sha256"].map((name) => join(dir, name));
    const keepOther = join(dir, "notes.txt");
    for (const file of [...ancient, ...recent, keepOther]) writeFileSync(file, "x");
    const old = new Date(Date.now() - 20 * 24 * 3600 * 1000);
    for (const file of [...ancient, keepOther]) utimesSync(file, old, old);
    expect(run("backup.sh", env).status).toBe(0);
    for (const file of ancient) expect(existsSync(file)).toBe(false);
    for (const file of [...recent, keepOther]) expect(existsSync(file)).toBe(true);
  });
});

shell("restore-check.sh, played on a temporary folder", () => {
  const prepared = (extra: NodeJS.ProcessEnv = {}, keys: { readonly documents?: string[]; readonly files?: string[] } = {}) => {
    const made = rig(extra);
    expect(run("backup.sh", made.env).status).toBe(0);
    const documents = join(made.root, "document-keys");
    const files = join(made.root, "file-keys");
    writeFileSync(documents, `${(keys.documents ?? [IDS[0] ?? ""]).join("\n")}\n`);
    writeFileSync(files, `${(keys.files ?? IDS.slice(1)).join("\n")}\n`);
    return { ...made, env: { ...made.env, FAKE_DOCUMENT_KEYS: posix(documents), FAKE_FILE_KEYS: posix(files) } };
  };

  it("restores the latest dump and its archive, counts the files and checks a sample", () => {
    const { env } = prepared();
    const result = run("restore-check.sh", env);
    expect(result.status, text(result)).toBe(0);
    const out = text(result);
    expect(out).toContain("restored");
    expect(out).toContain("4 files restored, the count matches the manifest");
    expect(out).toContain("4 sampled files match their recorded SHA-256");
    expect(out).toContain("vault documents missing from the archive: 0");
    expect(out).toContain("restored and verified");
  });

  it("fails when the restored database points at a vault document the archive does not hold", () => {
    const { env } = prepared({}, { documents: [IDS[0] ?? "", "abcd0000-0000-4000-8000-0000000000ff"] });
    const result = run("restore-check.sh", env);
    expect(result.status).toBe(1);
    expect(text(result)).toContain("vault document files are missing");
  });

  it("fails clearly on a backup made before the volume was covered", () => {
    const { dir, env } = prepared();
    for (const file of readdirSync(dir).filter((name) => name.includes("uploads"))) rmSync(join(dir, file));
    const result = run("restore-check.sh", env);
    expect(result.status).toBe(1);
    expect(text(result)).toContain("has no uploads archive and manifest");
  });
});
