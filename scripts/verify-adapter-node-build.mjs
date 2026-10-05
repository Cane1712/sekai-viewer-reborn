import assert from "node:assert/strict";
import { cpSync, mkdirSync, rmSync } from "node:fs";
import {
  mkdtemp,
  mkdir,
  readFile,
  realpath,
  readdir,
  rm,
  stat,
  symlink,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import adapter from "../apps/content-site/node_modules/@sveltejs/adapter-node/index.js";

const rootDirectory = fileURLToPath(new URL("../", import.meta.url));
const apps = ["content-site", "tools-site", "media-lab-site", "account-site"];
const runtimeVariables = {
  HOST: "127.0.0.1",
  PORT: "19453",
  ORIGIN: "http://127.0.0.1:19453",
  BODY_SIZE_LIMIT: "8388608",
  SHUTDOWN_TIMEOUT: "23"
};

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nestedFiles = await Promise.all(
    entries.map((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    })
  );

  return nestedFiles.flat();
}

function matchesChunkName(file, name) {
  return new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:-[^/]+)?\\.js$`).test(
    path.basename(file)
  );
}

async function verifyRuntimeEnvironment(buildDirectory, app) {
  const envModule = await import(pathToFileURL(path.join(buildDirectory, "env.js")).href);
  const previousValues = new Map(
    Object.keys(runtimeVariables).map((name) => [name, process.env[name]])
  );

  try {
    assert.equal(envModule.env_prefix, "", `${app} changed the default env prefix`);
    assert.equal(typeof envModule.env, "function", `${app} lost the env helper`);
    assert.equal(typeof envModule.timeout_env, "function", `${app} lost timeout_env`);

    for (const [name, value] of Object.entries(runtimeVariables)) {
      process.env[name] = value;
      assert.equal(envModule.env(name), value, `${app} did not read unprefixed ${name}`);
    }

    assert.equal(envModule.timeout_env("SHUTDOWN_TIMEOUT"), 23);
  } finally {
    for (const [name, value] of previousValues) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  }
}

async function verifyContentSiteClientManifest(appDirectory) {
  const clientDirectory = path.join(appDirectory, ".svelte-kit/output/client");
  const manifestPath = path.join(clientDirectory, ".vite/manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

  const [howlerEntry, eventDebugEntry] = ["howler", "EventDebugDialog"].map((name) => {
    const matchingEntries = Object.entries(manifest).filter(([, entry]) => entry.name === name);
    assert.equal(matchingEntries.length, 1, `content-site client manifest should retain ${name}`);
    return matchingEntries[0];
  });

  const [howlerKey, howler] = howlerEntry;
  const [eventDebugKey, eventDebugDialog] = eventDebugEntry;
  assert.equal(howler.isDynamicEntry, true, "content-site should retain Howler as a dynamic entry");

  for (const [name, entry] of [
    ["Howler", howler],
    ["EventDebugDialog", eventDebugDialog]
  ]) {
    const filePath = path.join(clientDirectory, entry.file);
    assert.ok((await stat(filePath)).size > 0, `content-site client ${name} file is empty`);
  }

  const eventDebugConsumers = Object.entries(manifest).filter(
    ([key, entry]) =>
      key.includes(".svelte-kit/generated/client-optimized/nodes/") &&
      entry.imports?.includes(eventDebugKey)
  );
  assert.ok(
    eventDebugConsumers.length > 0,
    "EventDebugDialog is not retained by a client route node"
  );

  const howlerConsumers = Object.values(manifest).filter((entry) =>
    entry.dynamicImports?.includes(howlerKey)
  );
  assert.ok(howlerConsumers.length > 0, "Howler is not retained as a client dynamic import");
}

async function verifyLiveExemptionsAtAdapterBoundary() {
  const fixtureDirectory = await realpath(
    await mkdtemp(path.join(os.tmpdir(), "adapter-node-chunk-fixture-"))
  );
  const serverDirectory = path.join(fixtureDirectory, ".svelte-kit/output/server");
  const oldWorkingDirectory = process.cwd();
  const oldFixtureEffects = globalThis.__adapterNodeChunkFixtureEffects;
  const oldFixtureValues = globalThis.__adapterNodeChunkFixtureValues;
  globalThis.__adapterNodeChunkFixtureEffects = [];
  delete globalThis.__adapterNodeChunkFixtureValues;

  try {
    await mkdir(path.join(serverDirectory, "chunks"), { recursive: true });
    await writeFile(
      path.join(fixtureDirectory, "package.json"),
      JSON.stringify({ type: "module", dependencies: {} })
    );
    await symlink(
      path.join(rootDirectory, "apps/content-site/node_modules"),
      path.join(fixtureDirectory, "node_modules"),
      "dir"
    );
    await writeFile(
      path.join(serverDirectory, "chunks/env.js"),
      'globalThis.__adapterNodeChunkFixtureEffects.push("env.js");\nexport const envValue = "env export";\n'
    );
    await writeFile(
      path.join(serverDirectory, "chunks/EventDebugDialog.js"),
      'globalThis.__adapterNodeChunkFixtureEffects.push("EventDebugDialog.js");\nexport const dialogValue = "dialog export";\n'
    );
    await writeFile(
      path.join(serverDirectory, "chunks/howler.js"),
      'globalThis.__adapterNodeChunkFixtureEffects.push("howler.js");\nexport const howlerValue = "howler export";\n'
    );
    await writeFile(
      path.join(serverDirectory, "chunks/retained.js"),
      'globalThis.__adapterNodeChunkFixtureEffects.push("retained.js");\nexport const retainedValue = "retained export";\n'
    );
    await writeFile(
      path.join(serverDirectory, "index.js"),
      [
        'import { envValue } from "./chunks/env.js";',
        'import { dialogValue } from "./chunks/EventDebugDialog.js";',
        'import { howlerValue } from "./chunks/howler.js";',
        'import { retainedValue } from "./chunks/retained.js";',
        "globalThis.__adapterNodeChunkFixtureValues = { envValue, dialogValue, howlerValue, retainedValue };",
        "export class Server {}"
      ].join("\n")
    );
    await writeFile(path.join(serverDirectory, "manifest.js"), "export const manifest = {};\n");

    const resolveFixturePath = (target) =>
      path.isAbsolute(target) ? target : path.join(fixtureDirectory, target);
    const builder = {
      config: { kit: { paths: { base: "" } } },
      prerendered: { paths: [] },
      getBuildDirectory: (name) => path.join(fixtureDirectory, ".svelte-kit", name),
      getServerDirectory: () => serverDirectory,
      rimraf: (target) => rmSync(resolveFixturePath(target), { recursive: true, force: true }),
      mkdirp: (target) => mkdirSync(resolveFixturePath(target), { recursive: true }),
      copy: (source, target) => cpSync(source, resolveFixturePath(target), { recursive: true }),
      writeClient: () => {},
      writePrerendered: () => {},
      log: { minor: (message) => console.log(`adapter fixture: ${message}`) }
    };

    process.chdir(fixtureDirectory);
    await adapter({ out: "build", precompress: false }).adapt(builder);

    const serverFiles = await listFiles(path.join(fixtureDirectory, "build/server"));
    const ssrEntry = serverFiles.find((file) => /\/chunks\/index\.js-[^/]+\.js$/.test(file));
    assert.ok(ssrEntry, "adapter fixture is missing its server entry chunk");
    const retainedFileStructuredChunk = serverFiles.find((file) =>
      /\/chunks\/chunks\/retained\.js-[^/]+\.js$/.test(file)
    );
    assert.ok(
      retainedFileStructuredChunk,
      `adapter fixture lost normal file-structured chunking: ${serverFiles
        .map((file) => path.relative(fixtureDirectory, file))
        .join(", ")}`
    );

    const serverModule = await import(pathToFileURL(ssrEntry).href);
    assert.equal(typeof serverModule, "object", "adapter fixture server chunk did not import");
    assert.deepEqual(globalThis.__adapterNodeChunkFixtureValues, {
      envValue: "env export",
      dialogValue: "dialog export",
      howlerValue: "howler export",
      retainedValue: "retained export"
    });
    assert.deepEqual(
      new Set(globalThis.__adapterNodeChunkFixtureEffects),
      new Set(["env.js", "EventDebugDialog.js", "howler.js", "retained.js"])
    );
  } finally {
    process.chdir(oldWorkingDirectory);
    if (oldFixtureEffects === undefined) {
      delete globalThis.__adapterNodeChunkFixtureEffects;
    } else {
      globalThis.__adapterNodeChunkFixtureEffects = oldFixtureEffects;
    }
    if (oldFixtureValues === undefined) {
      delete globalThis.__adapterNodeChunkFixtureValues;
    } else {
      globalThis.__adapterNodeChunkFixtureValues = oldFixtureValues;
    }
    await rm(fixtureDirectory, { recursive: true, force: true });
  }
}

for (const app of apps) {
  const appDirectory = path.join(rootDirectory, "apps", app);
  const buildDirectory = path.join(appDirectory, "build");
  const serverDirectory = path.join(buildDirectory, "server");
  const serverFiles = await listFiles(serverDirectory);
  const expectedExemptions =
    app === "content-site" ? ["env.js", "EventDebugDialog.js", "howler.js"] : ["env.js"];

  for (const chunkName of expectedExemptions) {
    const chunkArtifacts = serverFiles.filter((file) => {
      const relativePath = path.relative(serverDirectory, file);
      return (
        relativePath.startsWith(path.join("chunks", "chunks") + path.sep) &&
        matchesChunkName(file, chunkName)
      );
    });
    assert.deepEqual(
      chunkArtifacts,
      [],
      `${app} emitted an exempt adapter-node chunk ${chunkName}: ${chunkArtifacts.join(", ")}`
    );
  }

  const retainedFileStructuredChunks = serverFiles.filter((file) => {
    const relativePath = path.relative(serverDirectory, file);
    return (
      relativePath.startsWith(path.join("chunks", "chunks") + path.sep) &&
      file.endsWith(".js") &&
      !expectedExemptions.some((chunkName) => matchesChunkName(file, chunkName))
    );
  });
  assert.ok(
    retainedFileStructuredChunks.length > 0,
    `${app} should retain other file-structured server chunks`
  );

  const ssrEntryPath = serverFiles.find((file) =>
    /\/server\/chunks\/index\.js-[^/]+\.js$/.test(file)
  );
  assert.ok(ssrEntryPath, `${app} is missing its server SSR entry chunk`);
  const ssrEntry = await import(pathToFileURL(ssrEntryPath).href);
  assert.equal(typeof ssrEntry, "object", `${app} server SSR entry did not import`);

  const serverManifestPath = serverFiles.find((file) =>
    /\/server\/chunks\/manifest\.js-[^/]+\.js$/.test(file)
  );
  assert.ok(serverManifestPath, `${app} is missing its server route manifest`);
  const serverManifestModule = await import(pathToFileURL(serverManifestPath).href);
  const routeNodeLoaders = serverManifestModule.m?._?.nodes;
  assert.ok(Array.isArray(routeNodeLoaders), `${app} server manifest has no route nodes`);
  const routeNodeModules = await Promise.all(
    routeNodeLoaders.map((load, index) => {
      assert.equal(typeof load, "function", `${app} route node ${index} is not importable`);
      return load();
    })
  );
  assert.equal(routeNodeModules.length, routeNodeLoaders.length);
  assert.ok(
    routeNodeModules.every((routeNode) => routeNode && typeof routeNode === "object"),
    `${app} route-node imports returned an invalid module`
  );

  await verifyRuntimeEnvironment(buildDirectory, app);
  console.log(
    `${app}: no exempt chunks; SSR, route nodes, and unprefixed environment checks passed`
  );

  if (app === "content-site") {
    await verifyContentSiteClientManifest(appDirectory);
    console.log("content-site: client manifest retains Howler and EventDebugDialog entries");
  }
}

await verifyLiveExemptionsAtAdapterBoundary();
console.log("adapter fixture: exempt exports/side effects and ordinary chunking are preserved");
