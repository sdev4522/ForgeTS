#!/usr/bin/env bun
/**
 * TypeScript Documentation Query Helper for ForgeTS
 * 
 * Fast terminal search tool for indexed TypeScript language features,
 * type manipulation techniques, tsconfig options, and error diagnostics.
 * 
 * Usage:
 *   bun run .agents/skills/typescript/scripts/query-tsdocs.ts <term>
 *   bun run .agents/skills/typescript/scripts/query-tsdocs.ts --list
 *   bun run .agents/skills/typescript/scripts/query-tsdocs.ts --compiler-flags
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = resolve(__dirname, "..");
const REFERENCES_DIR = resolve(SKILL_ROOT, "references");

interface TopicEntry {
  title: string;
  category: "Handbook" | "Type Manipulation" | "Reference" | "Modules" | "TSConfig" | "Declarations" | "ForgeTS Patterns";
  keywords: string[];
  referenceFile: string;
  summary: string;
  officialDocUrl: string;
}

const INDEXED_TOPICS: TopicEntry[] = [
  {
    title: "Everyday Types & Primitives",
    category: "Handbook",
    keywords: ["primitive", "string", "number", "boolean", "null", "undefined", "any", "unknown", "never", "void", "array", "tuple"],
    referenceFile: "01-handbook-and-types.md",
    summary: "Basic primitive types, unions, intersections, arrays, tuples, and type aliases vs interfaces.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/everyday-types.html",
  },
  {
    title: "Type Narrowing & Guards",
    category: "Handbook",
    keywords: ["narrowing", "type guard", "typeof", "instanceof", "in", "discriminated union", "predicate", "is", "asserts"],
    referenceFile: "01-handbook-and-types.md",
    summary: "Refining union types via control flow analysis, truthiness, equality, 'in', 'instanceof', and custom type predicates.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/narrowing.html",
  },
  {
    title: "Compiler Diagnostics & Errors",
    category: "Handbook",
    keywords: ["error", "diagnostic", "ts2322", "ts2345", "ts2741", "ts2532", "ts1208", "ts1371"],
    referenceFile: "01-handbook-and-types.md",
    summary: "Diagnostic error codes, common compiler errors, and resolution strategies for framework development.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/understanding-errors.html",
  },
  {
    title: "Generics & Constraints",
    category: "Type Manipulation",
    keywords: ["generics", "generic function", "constraints", "extends", "default type arguments"],
    referenceFile: "02-type-manipulation.md",
    summary: "Writing reusable generic functions, classes, interfaces, and constraining type parameters with 'extends'.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/generics.html",
  },
  {
    title: "Keyof and Typeof Operators",
    category: "Type Manipulation",
    keywords: ["keyof", "typeof", "type query", "property names"],
    referenceFile: "02-type-manipulation.md",
    summary: "Extracting union of property keys with 'keyof' and capturing compile-time types from values with 'typeof'.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/keyof-type-operator.html",
  },
  {
    title: "Indexed Access Types",
    category: "Type Manipulation",
    keywords: ["indexed access", "lookup type", "element access", "T[K]"],
    referenceFile: "02-type-manipulation.md",
    summary: "Querying property types and array element types using indexed access syntax (Type[Key]).",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html",
  },
  {
    title: "Conditional Types & Infer",
    category: "Type Manipulation",
    keywords: ["conditional types", "infer", "distributive", "ternary", "pattern matching", "unwrapping"],
    referenceFile: "02-type-manipulation.md",
    summary: "Type-level branching with 'T extends U ? X : Y', distributive evaluation, and type extraction using 'infer'.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/conditional-types.html",
  },
  {
    title: "Mapped Types & Key Remapping",
    category: "Type Manipulation",
    keywords: ["mapped types", "as clause", "key remapping", "readonly modifier", "optional modifier"],
    referenceFile: "02-type-manipulation.md",
    summary: "Transforming object properties via mapped types, modifying optionality and mutability, and remapping keys with 'as'.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/mapped-types.html",
  },
  {
    title: "Template Literal Types",
    category: "Type Manipulation",
    keywords: ["template literal", "string literal", "uppercase", "lowercase", "capitalize", "route params"],
    referenceFile: "02-type-manipulation.md",
    summary: "String manipulation at type level, extracting route params (/users/:id), and combining string unions.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html",
  },
  {
    title: "Decorators & Metadata",
    category: "Reference",
    keywords: ["decorators", "reflect-metadata", "stage 3", "experimentaldecorators", "emitdecoratormetadata", "controller", "inject"],
    referenceFile: "03-advanced-reference.md",
    summary: "Stage 3 ECMAScript decorators vs experimental decorators with 'reflect-metadata' in ForgeTS controllers and models.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/decorators.html",
  },
  {
    title: "Declaration Merging",
    category: "Reference",
    keywords: ["declaration merging", "interface merging", "namespace merging", "plugin extensibility"],
    referenceFile: "03-advanced-reference.md",
    summary: "Merging interfaces and namespaces to enable consumer apps to extend framework context and container bindings.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/declaration-merging.html",
  },
  {
    title: "Built-in Utility Types",
    category: "Reference",
    keywords: ["utility types", "partial", "required", "readonly", "record", "pick", "omit", "returntype", "parameters", "awaited"],
    referenceFile: "03-advanced-reference.md",
    summary: "Standard TypeScript utility types for transforming, selecting, omitting, and inspecting types.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/utility-types.html",
  },
  {
    title: "Module Resolution & Interop",
    category: "Modules",
    keywords: ["moduleresolution", "bundler", "node16", "nodenext", "esm", "cjs", "interop", "import type", "isolatedmodules"],
    referenceFile: "04-modules-and-interop.md",
    summary: "Module resolution algorithms (bundler vs node16), ESM/CJS interop, type-only imports, and package.json exports.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/modules/introduction.html",
  },
  {
    title: "TSConfig Options & Strict Flags",
    category: "TSConfig",
    keywords: ["tsconfig", "compiler options", "strict", "noimplicitany", "strictnullchecks", "target", "path mapping", "skipLibCheck"],
    referenceFile: "05-tsconfig-and-compiler.md",
    summary: "Comprehensive guide to tsconfig.json options, strict mode flags, emit options, and path aliases.",
    officialDocUrl: "https://www.typescriptlang.org/tsconfig",
  },
  {
    title: "Declaration Files (.d.ts) Authoring",
    category: "Declarations",
    keywords: ["declaration files", ".d.ts", "ambient", "module augmentation", "declare global", "declare module"],
    referenceFile: "06-declaration-files.md",
    summary: "Creating and packaging .d.ts files, ambient type declarations, global augmentation, and library structures.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/declaration-files/introduction.html",
  },
  {
    title: "Type-Safe Routing Architecture",
    category: "ForgeTS Patterns",
    keywords: ["router", "type-safe routing", "url params", "route handler", "forgets router"],
    referenceFile: "07-framework-patterns.md",
    summary: "Recursive route parameter extraction and type-safe router design for ForgeTS.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/template-literal-types.html",
  },
  {
    title: "Typed Dependency Injection Container",
    category: "ForgeTS Patterns",
    keywords: ["container", "ioc", "dependency injection", "service token", "factory"],
    referenceFile: "07-framework-patterns.md",
    summary: "Inversion of Control container with token mapping, constructor reflection, and singleton management.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/generics.html",
  },
  {
    title: "ORM & Query Builder Typing",
    category: "ForgeTS Patterns",
    keywords: ["orm", "model", "query builder", "proxy", "database typing", "kysely"],
    referenceFile: "07-framework-patterns.md",
    summary: "Dynamic model proxies, column selection inference, and Active Record patterns in ForgeTS.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/2/indexed-access-types.html",
  },
  {
    title: "SSR & View Props Serialization",
    category: "ForgeTS Patterns",
    keywords: ["ssr", "hydration", "react 19", "serializable", "view props", "tsx"],
    referenceFile: "07-framework-patterns.md",
    summary: "Ensuring view props crossing the SSR-to-client boundary remain JSON-serializable and strictly typed.",
    officialDocUrl: "https://www.typescriptlang.org/docs/handbook/jsx.html",
  },
];

function searchTopics(query: string): TopicEntry[] {
  const q = query.toLowerCase().trim();
  return INDEXED_TOPICS.filter((t) => {
    return (
      t.title.toLowerCase().includes(q) ||
      t.summary.toLowerCase().includes(q) ||
      t.category.toLowerCase().includes(q) ||
      t.keywords.some((k) => k.toLowerCase().includes(q))
    );
  });
}

function printHelp() {
  console.log(`
TypeScript Documentation Lookup Tool (ForgeTS Skill)
=====================================================
Usage:
  bun run query-tsdocs.ts <search-term>
  bun run query-tsdocs.ts --list
  bun run query-tsdocs.ts --all

Examples:
  bun run query-tsdocs.ts "conditional types"
  bun run query-tsdocs.ts "moduleResolution"
  bun run query-tsdocs.ts "decorators"
  bun run query-tsdocs.ts "strictNullChecks"
`);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    process.exit(0);
  }

  if (args[0] === "--list") {
    console.log("\n=== Indexed TypeScript Documentation Topics ===\n");
    for (const t of INDEXED_TOPICS) {
      console.log(`- [${t.category}] ${t.title}`);
      console.log(`  File: references/${t.referenceFile}`);
      console.log(`  URL:  ${t.officialDocUrl}\n`);
    }
    process.exit(0);
  }

  if (args[0] === "--all") {
    console.log(`Checking all ${INDEXED_TOPICS.length} indexed topics...`);
    let missing = 0;
    for (const t of INDEXED_TOPICS) {
      const fullPath = resolve(REFERENCES_DIR, t.referenceFile);
      if (!existsSync(fullPath)) {
        console.error(`MISSING: ${fullPath}`);
        missing++;
      }
    }
    if (missing === 0) {
      console.log(`✅ All ${INDEXED_TOPICS.length} topics link to valid reference files.`);
      process.exit(0);
    } else {
      console.error(`❌ ${missing} reference files missing.`);
      process.exit(1);
    }
  }

  const query = args.join(" ");
  const results = searchTopics(query);

  if (results.length === 0) {
    console.log(`\nNo direct match for "${query}".`);
    console.log(`Try broader terms like "generics", "tsconfig", "narrowing", "modules", or run with --list.`);
    process.exit(1);
  }

  console.log(`\nFound ${results.length} result(s) for "${query}":\n`);
  for (const r of results) {
    console.log(`------------------------------------------------------------`);
    console.log(`📌 ${r.title} (${r.category})`);
    console.log(`------------------------------------------------------------`);
    console.log(`Summary:  ${r.summary}`);
    console.log(`Keywords: ${r.keywords.join(", ")}`);
    console.log(`Guide:    .agents/skills/typescript/references/${r.referenceFile}`);
    console.log(`Docs:     ${r.officialDocUrl}\n`);
  }
}

main();
