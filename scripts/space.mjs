// Insert blank lines to open up dense code, which no formatter will do: Prettier and
// oxfmt preserve the blank lines you write but never add one, and Oxlint has no
// padding-line-between-statements. Run after `npm run format`; oxfmt keeps the result.
//
//   1. after a block-like statement (if/for/while/switch/try/function/class/method)
//   2. after a run of variable declarations, before the first non-declaration
//   3. above a return, unless it is the only statement in its block
//
// Only fires when the next statement starts on the very next line, so it is idempotent
// and never overrides spacing you chose. Uses the TypeScript parser, so template
// literals and string contents are never touched.
//
// Usage: node scripts/space.mjs [files...]   (defaults to every tracked source file)
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

// TypeScript lives in the plugin's own node_modules.
const require = createRequire(new URL('../src/', import.meta.url));
const ts = require('typescript');

const BLOCK_LIKE = new Set([
	ts.SyntaxKind.IfStatement,
	ts.SyntaxKind.ForStatement,
	ts.SyntaxKind.ForInStatement,
	ts.SyntaxKind.ForOfStatement,
	ts.SyntaxKind.WhileStatement,
	ts.SyntaxKind.SwitchStatement,
	ts.SyntaxKind.TryStatement,
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.ClassDeclaration,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.Constructor,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.SetAccessor,
]);

const isVariable = (node) => node.kind === ts.SyntaxKind.VariableStatement;

// Declarations without a body (ambient .d.ts signatures, overload signatures) are dense
// lists, not blocks -- spacing them out hurts readability.
const NEEDS_BODY = new Set([
	ts.SyntaxKind.FunctionDeclaration,
	ts.SyntaxKind.MethodDeclaration,
	ts.SyntaxKind.Constructor,
	ts.SyntaxKind.GetAccessor,
	ts.SyntaxKind.SetAccessor,
]);

const isBlockLike = (node) => BLOCK_LIKE.has(node.kind) && (!NEEDS_BODY.has(node.kind) || Boolean(node.body));

function addSpacing(file) {
	const text = readFileSync(file, 'utf8');
	const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
	const insertAt = new Set();

	const consider = (list) => {
		for (let i = 0; i < list.length - 1; i++) {
			const prev = list[i];
			const next = list[i + 1];

			// Rule 1: after a block. Rule 2: end of a declaration run. Rule 3: above a
			// return. A block whose only statement is a return has no pair, so short
			// guard clauses stay tight.
			const afterBlock = isBlockLike(prev);
			const endOfDeclarations = isVariable(prev) && !isVariable(next);
			const beforeReturn = next.kind === ts.SyntaxKind.ReturnStatement;
			if (!afterBlock && !endOfDeclarations && !beforeReturn) continue;

			const prevEndLine = sf.getLineAndCharacterOfPosition(prev.getEnd()).line;

			// Start from any leading comment so a comment stays glued to what it documents.
			const ranges = ts.getLeadingCommentRanges(text, next.getFullStart()) || [];
			const nextStart = ranges.length > 0 ? ranges[0].pos : next.getStart(sf);
			const nextStartLine = sf.getLineAndCharacterOfPosition(nextStart).line;

			if (nextStartLine === prevEndLine + 1) {
				insertAt.add(sf.getPositionOfLineAndCharacter(nextStartLine, 0));
			}
		}
	};

	const walk = (node) => {
		if (ts.isSourceFile(node) || ts.isBlock(node) || ts.isModuleBlock(node)) consider(node.statements);
		else if (ts.isCaseClause(node) || ts.isDefaultClause(node)) consider(node.statements);
		else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) consider(node.members);
		ts.forEachChild(node, walk);
	};
	walk(sf);

	if (insertAt.size === 0) return 0;

	let out = text;
	for (const pos of [...insertAt].sort((a, b) => b - a)) out = out.slice(0, pos) + '\n' + out.slice(pos);
	writeFileSync(file, out);
	return insertAt.size;
}

const args = process.argv.slice(2);
const files =
	args.length > 0
		? args
		: execFileSync('git', ['ls-files', '*.ts', '*.cjs', '*.mjs'], { encoding: 'utf8' })
				.split('\n')
				.filter((f) => f && !f.startsWith('demo/platforms/'));

let total = 0;
for (const file of files) {
	const n = addSpacing(file);
	if (n > 0) console.log(`  ${file}: +${n}`);
	total += n;
}
console.log(`total blank lines inserted: ${total}`);
