import { parseArgs } from "node:util"
import DeepMerge from "@fastify/deepmerge"
import path from "node:path"
import { Edge, Template } from "edge.js"
import yaml from "js-yaml"
import { globby } from 'globby'
import pMap from "p-map"
import fs from "node:fs/promises"
import dedent from "dedent"

const args = await getArgs()
const edge = bootstrapEdge()
const dMerge = DeepMerge()

const templates = await collectTemplates()
if (!templates?.length) fail("No templates could be found")
const context = await parseContext(args.contextPath)
await generateFiles(templates!, context)

// ---

async function parseContext(ctxPath: string | undefined): Promise<any> {
    if (!ctxPath) return {}

    const rawContext = await fs.readFile(ctxPath, "utf-8").catch(e => {
        fail(`Failed to read context file: ${ctxPath}`)
    })

    if (rawContext && ctxPath.endsWith(".json")) {
        try {
            return JSON.parse(rawContext)
        } catch (e) {
            console.error(e)
            fail(`Failed to parse context file as json: ${ctxPath}`)
        }
    }

    if (rawContext && (ctxPath.endsWith(".yaml") || ctxPath.endsWith(".yml"))) {
        try {
            return yaml.load(rawContext)
        } catch (e) {
            console.error(e)
            fail(`Failed to parse context file as yaml: ${ctxPath}`)
        }
    }

    fail(`Unsupported context file extension: ${ctxPath}`)
}

interface TemplateRef {
    key: string
    path: string
    isMulti: boolean
}

async function collectTemplates(): Promise<TemplateRef[]> {
    const inputPath = args.inputPath ?? process.cwd()
    const inputExt = args.inputExtension ?? "edge"
    const inputStat = await fs.stat(inputPath)

    if (inputStat.isDirectory()) {
        edge.mount(path.resolve(inputPath))
        const pattern = `**/*.${inputExt}`
        const templatePaths = await globby([pattern], {
            cwd: inputPath
        })
        return compact(templatePaths.map(p => {
            if (isIgnored(p)) return null
            const key = path.join(path.dirname(p), getFileNameWithoutExt(p))
            const multiMatch = key.match(/^(.*)\.multi$/)
            if (multiMatch) {
                return {
                    path: p,
                    key,
                    isMulti: true
                }
            }
            return {
                path: p,
                key,
                isMulti: false
            }
        }))
    }
    if (inputStat.isFile()) {
        const tmplKey = getFileNameWithoutExt(inputPath)
        edge.registerTemplate(tmplKey, {
            template: await fs.readFile(inputPath, "utf-8")
        })
        return [{
            key: tmplKey,
            path: inputPath,
            isMulti: false
        }]
    }
    fail("Expected input to be file or directory")
}

async function generateFiles(templates: TemplateRef[], context: any) {
    const failedKeys: string[] = []
    await pMap(
        templates,
        (t) => generateFile(t, context).catch(e => {
            console.error(`Failure generating ${t}:`, e)
            failedKeys.push(t.key)
        }),
        { concurrency: 5 }
    )
    if (failedKeys.length)
        fail(`Failed to generate: ${failedKeys.join(", ")}`)
}

async function generateFile(template: TemplateRef, baseContext: any) {
    const context = await getContext(template, baseContext);
    const content = await edge.render(template.key, context)
    if (template.isMulti) {
        return generateMulti(template, content)
    }
    const outPath = args.skipOutputExtension
        ? template.key
        : `${template.key}.${args.outputExtension ?? "html"}`
    await writeFile(outPath, content, template.path)
}

async function generateMulti(template: TemplateRef, content: string) {
    const xml2js = await import("xml2js");
    const tree = await xml2js.parseStringPromise(`<root>${content}</root>`)
    if (!Array.isArray(tree.root.file))
        throw new Error(`Invalid format: ${template.path} - file tag missing`)
    for (const f of tree.root.file) {
        const outPath: string = f?.$?.path
        if (typeof outPath != "string") {
            throw new Error(`Invalid format: ${template.path} - path attribute missing`)
        }
        let fileContent = f._ || "";
        if (isAttrTrue(f.$.dedent))
            fileContent = dedent(fileContent)
        if (isAttrTrue(f.$.trim) || isAttrTrue(f.$.strip))
            fileContent = fileContent.trim()
        await writeFile(outPath, fileContent, template.path)
    }
}

function isAttrTrue(val: string) {
    const lVal = val.toLowerCase();
    return lVal === "true" || lVal === "yes"
}

async function writeFile(outPath: string, content: string, sourcePath: string) {
    const outDir = args.outputPath ?? process.cwd()
    const finalOutPath = path.join(outDir, outPath)
    console.log(`Generating file: ${sourcePath} -> ${outPath}`)
    await fs.mkdir(path.dirname(finalOutPath), {
        recursive: true
    })
    await fs.writeFile(finalOutPath, content, {
        encoding: "utf-8"
    })
}

async function getContext(template: TemplateRef, baseContext: any) {
    if (!args.relativeContextPath) return baseContext;
    const localContext = await parseContext(path.resolve(
        args.inputPath ?? process.cwd(),
        path.dirname(template.path),
        args.relativeContextPath
    ))
    return dMerge(baseContext, localContext)
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
    console.error(msg)
    process.exit(1)
}

function isIgnored(p: string) {
    return p.startsWith(".") || p.startsWith("_")
}

function getFileNameWithoutExt(p: string) {
    return path.basename(p, path.extname(p))
}

function compact<T>(arr: T[]): NonNullable<T>[] {
    return arr.filter(Boolean) as NonNullable<T>[]
}