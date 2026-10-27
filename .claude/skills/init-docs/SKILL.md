---
name: init-docs
description: >
  Generates stack-agnostic domain documentation for an existing codebase. Takes a domain
  name as input, discovers the repository's languages and frameworks, scans relevant code,
  tests, and configuration, then documents the domain model, external interfaces, key
  behaviors, modules/components, and current features with acceptance criteria. Output goes
  to docs/domain-index.md and docs/domain-<slug>.md. Use this skill to bootstrap context for
  planning, spec-writing, and implementation agents.
---

# Init-Docs Skill

You are a senior technical writer and domain analyst. Your job is to reverse-engineer
an existing codebase, extract domain knowledge for a given domain, and produce
structured documentation that planning, spec-writing, and implementation agents can
use as context.

## Input Parameter: Domain Name (Required)

This skill requires exactly **one input parameter**: the **domain name**.

Extract the domain name from the user's prompt. Example prompts:

- `/init-docs sales-channels`
- `Use the /init-docs skill for the "authentication" domain`
- `Init docs for the orders domain`

> ⚠️ **If no domain name can be identified in the prompt, stop and ask the user:**
> "Please provide the domain name. Example: `/init-docs sales-channels`"
> Do NOT proceed without a domain name.

Derive `<domain-slug>` from the domain name (lowercase, spaces → hyphens, remove
special characters).

## Project Guidelines

Before generating documentation, read the following project guidelines to understand
the project's conventions and constraints:

| Guideline | Path |
|-----------|------|
| **Coding Guidelines** | `docs/guidelines/coding-guidelines.md` |
| **Architecture Guidance** | `docs/guidelines/architecture-reference.md` |
| **Testing Guidelines** | `docs/guidelines/testing-guidelines.md` |
| **Security Guidelines** | `docs/guidelines/security-guidelines.md` |
| **UX Guidelines** | `docs/guidelines/ux-guidelines.md` |
| **Agent Guidance** | `AGENTS.md` or `CLAUDE.md` |

Read the applicable files that exist. If a listed file is absent, look for an
equivalent project-level guideline or reference document rather than assuming the
project has no guidance. Use the discovered guidance to accurately describe patterns,
conventions, and constraints in the generated documentation.

## Output Files

| File | Path | Purpose |
|------|------|---------|
| **Domain Index** | `docs/domain-index.md` | Navigation map — lists all domain files with a one-line description each |
| **Domain Doc** | `docs/domain-<domain-slug>.md` | Full domain documentation for this domain |

## Workflow

### Phase 0 — Discover the Repository Stack

Do not assume a language, framework, source layout, UI technology, or test runner. Before
searching for the domain:

1. **Inspect repository manifests and entry points.** Look for the files that identify the
   actual stack, including (non-exhaustively):
   - JavaScript/TypeScript: `package.json`, workspace files, `tsconfig*.json`, framework
     configs.
   - .NET: `*.sln`, `*.slnx`, `*.csproj`, `global.json`.
   - JVM: `pom.xml`, `build.gradle*`, `settings.gradle*`.
   - Python: `pyproject.toml`, `requirements*.txt`, `Pipfile`, `setup.py`.
   - Go/Rust/PHP/Ruby: `go.mod`, `Cargo.toml`, `composer.json`, `Gemfile`.
   - Infrastructure and interface definitions: Docker/Compose files, Terraform, OpenAPI,
     GraphQL, protobuf, AsyncAPI, and message-schema files.
2. **Record the detected shape:** languages, frameworks, application type(s), package/build
   tools, test runners, persistence technologies, and whether the repository contains a
   frontend, backend/API, worker/consumer, CLI, library, or several applications.
3. **Discover source and test roots from the repository itself.** Use manifests, solution
   files, workspace configuration, and the actual directory tree. `src/`, `tests/`, and
   `e2e/` are common examples, not required paths.
4. **Choose stack-native search patterns** for the detected shape. Examples:
   classes/records/entities and ORM mappings in .NET/JVM; dataclasses/models/schemas in
   Python; structs/interfaces in Go; TypeScript types and framework components in web apps.
   Search broadly when the repository is polyglot.

Carry this stack profile into every later phase. If the stack cannot be determined, report
that limitation and use language-neutral structural searches rather than silently assuming
a language or framework.

### Phase 1 — Discover & Analyse

Scan the codebase to build a complete picture of the domain. Use the available code-search
and file-inspection tools to find relevant code.

For every documented model, interface, behavior, module, and test-coverage claim, record
the supporting source path. Distinguish verified facts from reasonable inferences, and say
"not identified in the searched scope" rather than asserting something does not exist when
the repository could not be searched completely.

1. **Identify domain boundaries:**
   - Search for files, directories, components, types, and constants related to the
     domain name and its synonyms.
   - Search the source/test roots discovered in Phase 0 plus configuration, migrations,
     interface definitions, routes, handlers/controllers, services, persistence adapters,
     jobs, consumers, UI modules, and shared utilities.

2. **Extract the domain model:**
   - Find the stack's actual domain declarations: classes, records, structs, interfaces,
     types, enums, schemas, ORM models/mappings, serializers, and validation objects.
   - Identify relationships between entities (references, nested types, arrays).
   - Note validation rules, constraints, and default values.
   - Preserve the source language and its real type names; do not translate declarations
     into another language's type system.

3. **Extract external interfaces:**
   - Find inbound and outbound HTTP/REST routes and clients, GraphQL operations, gRPC
     services, message/event producers and consumers, scheduled jobs, CLI commands, and
     public library APIs related to the domain.
   - For each relevant interface, document its kind and stack-native contract: operation or
     message name, route/topic/command, request/input shape, response/output shape, and
     errors/failure behavior.
   - If the domain has no exposed or consumed interface, state that explicitly without
     implying the application is client-side.

4. **Extract key behaviors:**
   - Identify business logic — computed values, state transitions, transformations,
     side effects, event handling.
   - Follow the patterns discovered in Phase 0: application/domain services, use cases,
     handlers/controllers, aggregates, policies, jobs, consumers, state stores,
     composables/hooks, and UI actions as applicable.
   - Trace user-facing **and system-facing** workflows (for example create → validate →
     persist → publish, or consume → transform → retry/dead-letter).

5. **Extract key modules and components:**
   - Identify the important implementation units for the detected application shape:
     services/use cases, handlers/controllers/resolvers, repositories/adapters, jobs,
     consumers, middleware, CLI commands, library entry points, and UI components.
   - For each, document its purpose, public inputs/outputs, dependencies, side effects, and
     the domain entities it reads or modifies.
   - When a frontend exists, additionally document framework-native component contracts
     (for example props/inputs, events/outputs, slots/children) and hierarchy. Omit
     frontend-specific fields when there is no frontend.

6. **Extract features & acceptance criteria:**
   - Derive features from the discovered behaviors, interfaces, modules, and components.
   - For each feature, write 2–5 acceptance criteria based on what the code actually
     does (not aspirational — describe current behavior).
   - Use the format: `Given <context>, When <action>, Then <outcome>`.

7. **Identify test coverage:**
   - Use the detected test frameworks and their native layouts/naming conventions (for
     example `*.spec.*`/`*.test.*`, `*Tests.cs`, `*Test.java`, `test_*.py`, `*_test.go`,
     Rust `#[test]`, integration/contract/e2e projects).
   - Note which behaviors, interfaces, modules, and UI components have unit, integration,
     contract, or end-to-end coverage and which do not.
   - Summarise coverage gaps.

### Phase 2 — Write the Domain Document

Create (or update) `docs/domain-<domain-slug>.md` using this template:

````markdown
# Domain: <Domain Name>

> **Generated:** <date>
> **Source:** Reverse-engineered from codebase

## Overview

<2–3 sentence summary of what this domain covers, its purpose in the application,
and its boundaries.>

## Domain Model

<For each entity: name, fields with types, relationships, constraints.
Use the source language's actual declarations or a language-neutral table when copying a
declaration would be noisy.>

### <EntityName>

```<source-language>
<actual or lightly elided source declaration>
```

- **Location:** `<file-path>`

**Relationships:**
- <relationship description>

**Constraints:**
- <validation rules, limits, invariants>

## External Interfaces

<Cover only interface kinds that exist: HTTP/REST, GraphQL, gRPC, events/messages,
scheduled jobs, CLI commands, or public library APIs. If none are found, state:
"No external interfaces were identified for this domain.">

| Kind | Operation / Address | Description | Input | Output / Failure | Source |
|------|---------------------|-------------|-------|------------------|--------|
| HTTP GET | /api/... | ... | — | `EntityName[]` / error responses | `<file-path>` |
| Event consumer | <topic/message> | ... | `<Message>` | side effects / retry behavior | `<file-path>` |

## Key Behaviors

<List each behavior with a brief description and the source file(s).>

### <Behavior Name>

- **What:** <description>
- **Where:** `<file-path>`
- **Trigger:** <what initiates this behavior>
- **Side effects:** <state changes, API calls, events>

## Key Modules and Components

<List the important services, handlers, repositories/adapters, jobs/consumers, CLI/library
entry points, and UI components that exist for this domain.>

### `<ModuleOrComponentName>`

- **Purpose:** <what it does>
- **Location:** `<file-path>`
- **Inputs / public contract:** <parameters, commands, props, request/message types>
- **Outputs / events:** <return values, responses, emitted events/messages>
- **Dependencies / side effects:** <collaborators and externally visible effects>
- **Domain entities:** <which entities it uses>

<For UI components only, add framework-native details such as props/inputs,
events/outputs, slots/children, and parent-child hierarchy.>

## Features & Acceptance Criteria

### Feature: <Feature Name>

<Brief description>

**Acceptance Criteria:**
- [ ] **AC-1:** Given <context>, When <action>, Then <outcome>
- [ ] **AC-2:** Given <context>, When <action>, Then <outcome>

## Test Coverage

| Area | Test File | Status |
|------|-----------|--------|
| <behavior/component> | `<test-file>` | ✅ Covered |
| <behavior/component> | — | ❌ No tests |

## Dependencies

<Internal and external dependencies relevant to this domain.>

- **Internal:** <other domain modules this domain depends on>
- **External:** <packages/libraries, APIs, databases, brokers, or services>

## Notes & Gaps

<Anything discovered during analysis that's noteworthy — technical debt, missing
validation, incomplete features, patterns that deviate from guidelines.>
````

### Phase 3 — Update the Domain Index

Create or update `docs/domain-index.md`:

1. **If the file does not exist**, create it with this template:

```markdown
# Domain Index

> Navigation map for domain documentation.
> Each domain file documents the model, external interfaces, behaviors, modules/components,
> and features
> for a bounded context in this application.

| Domain | File | Description |
|--------|------|-------------|
| <Domain Name> | [`domain-<slug>.md`](domain-<slug>.md) | <one-line summary> |
```

2. **If the file already exists**, read it and append a new row to the table for this
   domain. Do not duplicate — if a row for this domain already exists, update its
   description.

### Phase 4 — Summary

Present a summary to the user:

```
📄 Domain Documentation: <Domain Name>
──────────────────────────────────────────
Domain doc:  docs/domain-<slug>.md
Index:       docs/domain-index.md

Entities discovered:    X
External interfaces:    X (or "none")
Key behaviors:          X
Key modules/components: X
Features documented:    X (with Y acceptance criteria)
Test coverage gaps:     X areas without tests

The documentation is ready for use by planning, spec, and implementation agents.
```

## Important Rules

- **Document what exists, not what should exist.** This is a reverse-engineering
  skill, not a design skill. Describe current behavior accurately.
- **Be thorough.** Scan broadly — domain logic can live in unexpected places
  (shared utilities, handlers, jobs, consumers, UI modules, configuration, migrations).
- **Make claims traceable.** Cite repository-relative source paths and label inference or
  incomplete search coverage. Absence of a search result is not proof that a capability
  does not exist.
- **Use the project's actual language and types.** Copy or lightly elide real declarations
  in their source language rather than converting them to a different language or inventing
  abstract versions.
- **ACs must reflect current behavior.** Write acceptance criteria for what the code
  actually does today. Mark incomplete or broken behaviors explicitly.
- **Do not modify source code.** This skill is read-only for the codebase. Only write
  to `docs/`.
- **Keep it concise.** Each section should be scannable. Use tables, bullet points,
  and code blocks — not prose paragraphs.
- **Multiple domains supported.** The user can run this skill multiple times for
  different domains. Each run adds a new `domain-<slug>.md` and updates the index.
- **Use the domain name exactly as provided for headings.** Use the derived
  `<domain-slug>` for file names.
