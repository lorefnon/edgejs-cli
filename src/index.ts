import { parseArgs } from "node:util"
import DeepMerge from "@fastify/deepmerge"
import path from "node:path"
import { Edge, Template } from "edge.js"
import yaml from "js-yaml"
import { globby } from 'globby';
import pMap from "p-map"
import fs from "node:fs/promises"

const args = await getArgs();
const edge = bootstrapEdge();
const dMerge = DeepMerge();

const templateKeys = await collectInputFiles();
if (!templateKeys?.length) fail("No templates could be found")
const context = await parseContext(args.contextPath);
await generateFiles(templateKeys!, context)

// ---

async function parseContext(ctxPath: string | undefined): Promise<any> {
    if (!ctxPath) return {}

    const rawContext = await fs.readFile(ctxPath, "utf-8").catch(e => {
        fail(`Failed to read context file: ${ctxPath}`)
    });
    if (rawContext && ctxPath.endsWith(".json")) {
        try {
            return JSON.parse(rawContext)
        } catch (e) {
            console.error(e)
            fail(`Failed to parse context file as json: ${ctxPath}`)
        }
    } else if (rawContext && (ctxPath.endsWith(".yaml") || ctxPath.endsWith(".yml"))) {
        try {
            return yaml.load(rawContext)
        } catch (e) {
            console.error(e)
            fail(`Failed to parse context file as yaml: ${ctxPath}`)
        }
    } else fail(`Unsupported context file extension: ${ctxPath}`)
}

async function collectInputFiles() {
    const inputPath = args.inputPath ?? process.cwd();
    const inputExt = args.inputExtension ?? "edge";
    const inputStat = await fs.stat(inputPath);

    if (inputStat.isDirectory()) {
        edge.mount(path.resolve(inputPath))
        const pattern = `**/*.${inputExt}`
        const templatePaths = await globby([pattern], {
            cwd: inputPath
        })
        return templatePaths
            .map(p => {
                if (p.startsWith(".") || p.startsWith("_"))
                    return "";
                const key = path.join(path.dirname(p), path.basename(p, path.extname(p)))
                return key;
            })
            .filter(Boolean)
    }
    if (inputStat.isFile()) {
        const tmplKey = path.basename(inputPath)
        edge.registerTemplate(tmplKey, {
            template: await fs.readFile(inputPath, "utf-8")
        })
        return [tmplKey]
    }
    fail("Expected input to be file or directory");
}

async function generateFiles(templateKeys: string[], context: any) {
    const failedKeys: string[] = [];
    await pMap(
        templateKeys,
        (k) => generateFile(k, context).catch(e => {
            console.error(`Failure generating ${k}:`, e)
            failedKeys.push(k)
        }),
        { concurrency: 5 }
    );
    if (failedKeys.length)
        fail(`Failed to generate: ${failedKeys.join(", ")}`)
}

async function generateFile(tmplKey: string, context: any) {
    const outDir = args.outputPath ?? process.cwd();
    const outPath = args.skipOutputExtension
        ? path.join(outDir, tmplKey)
        : path.join(outDir, `${tmplKey}.${args.outputExtension ?? "html"}`)
    console.log(`Generating file: ${tmplKey} -> ${outPath}`)
    let tmplContext = context;
    if (args.relativeContextPath) {
        const localContext = await parseContext(path.resolve(
            args.inputPath ?? process.cwd(),
            path.dirname(tmplKey),
            args.relativeContextPath
        ))
        tmplContext = dMerge(tmplContext, localContext)
    }
    const content = await edge.render(tmplKey, tmplContext);
    await fs.mkdir(path.dirname(outPath), {
        recursive: true
    })
    await fs.writeFile(outPath, content, {
        encoding: "utf-8"
    })
}

function bootstrapEdge() {
    const edge = Edge.create({
        cache: false
    })
    if (args.skipEscaping) {
        Template.prototype.escape = (input: any) => input
    }
    return edge

}

async function getArgs() {
    return parseArgs({
        options: {
            inputPath: {
                type: "string",
                short: "i"
            },
            outputPath: {
                type: "string",
                short: "o"
            },
            contextPath: {
                type: "string",
                short: "c"
            },
            relativeContextPath: {
                type: "string",
                short: "c"
            },
            inputExtension: {
                type: "string",
            },
            outputExtension: {
                type: "string",
            },
            skipOutputExtension: {
                type: "boolean",
            },
            skipEscaping: {
                type: "boolean",
            },
        }
    }).values

}

function fail(msg: string): never {
    console.error(msg);
    process.exit(1)
}

