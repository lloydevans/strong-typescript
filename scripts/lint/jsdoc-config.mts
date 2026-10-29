import { defineConfig } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";

/** false covers the listed declarations; true delegates to the plugin's publicOnly option. */
const DOCUMENT_PUBLIC_ONLY = false;

/** Inline function arguments and JSX attribute handlers need no separate documentation. */
const INLINE_CALLBACKS =
	":matches(:matches(CallExpression, NewExpression) > :matches(FunctionExpression, ArrowFunctionExpression).arguments, JSXAttribute > JSXExpressionContainer > :matches(FunctionExpression, ArrowFunctionExpression))";

/** An object's declared type documents function-valued properties; accessors still need their own documentation. */
const OBJECT_FUNCTIONS = 'ObjectExpression > Property[kind="init"] > :matches(FunctionExpression, ArrowFunctionExpression).value';

/** A function variable is documented by its declaration or enclosing function. */
const VARIABLE_FUNCTIONS = "VariableDeclarator > :matches(FunctionExpression, ArrowFunctionExpression).init";

/** Require comments on class fields. */
const CLASS_PROPERTIES =
	":matches(PropertyDefinition, TSAbstractPropertyDefinition, AccessorProperty, TSAbstractAccessorProperty)";

/** Select callables whose parameter and return types own their documentation. */
const DOCUMENTED_FUNCTIONS = `:matches(:function, TSDeclareFunction, TSEmptyBodyFunctionExpression):not(${INLINE_CALLBACKS}):not(${OBJECT_FUNCTIONS}):not(${VARIABLE_FUNCTIONS})`;

/** Enter declared types without entering initializers or function bodies. */
const DECLARED_TYPES = `:matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, ClassBody > TSIndexSignature, ${CLASS_PROPERTIES} > TSTypeAnnotation, :matches(ClassDeclaration, ClassExpression, ${DOCUMENTED_FUNCTIONS}) > :matches(TSTypeAnnotation, TSTypeParameterDeclaration, TSTypeParameterInstantiation, TSClassImplements), ${DOCUMENTED_FUNCTIONS} > *.params > TSTypeAnnotation, ${DOCUMENTED_FUNCTIONS} > AssignmentPattern.params > *.left > TSTypeAnnotation, :matches(Program, TSModuleBlock, ExportNamedDeclaration) > VariableDeclaration > VariableDeclarator > *.id > TSTypeAnnotation)`;

/** Document members at every type depth, except conditional matching patterns. */
const TYPE_MEMBERS = `:matches(ClassBody, TSInterfaceBody, ${DECLARED_TYPES} TSTypeLiteral) > :matches(TSMethodSignature, TSPropertySignature, TSCallSignatureDeclaration, TSConstructSignatureDeclaration, TSIndexSignature):not(TSConditionalType > *.extendsType *)`;

/** With every declaration covered, an export that declares nothing uses the documentation at its declaration. */
const DECLARING_EXPORTS =
	"ExportNamedDeclaration[declaration], ExportDefaultDeclaration:not([declaration.type='Identifier']), TSExportAssignment:not([expression.type='Identifier'])";

/**
 * With publicOnly the plugin leaves a declaration exported by name unchecked, so only a re-export goes without a comment.
 * It never reports an export assignment there, so `export = name;` stays unchecked.
 */
const PUBLIC_EXPORTS = "ExportNamedDeclaration:not([source]), ExportDefaultDeclaration, TSExportAssignment";

/**
 * Cover declarations, named-type members and the exports that need a comment of their own.
 * @param publicOnly - Whether the plugin checks only the exported surface.
 * @returns A selector for the nodes that need documentation.
 */
function declarations(publicOnly: boolean) {
	return `:matches(FunctionExpression, ArrowFunctionExpression, MethodDefinition, TSAbstractMethodDefinition, TSDeclareFunction, TSInterfaceDeclaration, TSTypeAliasDeclaration, TSEnumDeclaration, TSEnumMember, TSModuleDeclaration:not(ExportNamedDeclaration > TSModuleDeclaration), ${publicOnly ? PUBLIC_EXPORTS : DECLARING_EXPORTS}, TSNamespaceExportDeclaration, ${TYPE_MEMBERS}):not(${INLINE_CALLBACKS}):not(${OBJECT_FUNCTIONS}):not(${VARIABLE_FUNCTIONS})`;
}

/** Preserve the plugin's function contexts and check type contracts, not just their implementations. */
const functionContexts = [
	"ArrowFunctionExpression",
	"FunctionDeclaration",
	"FunctionExpression",
	"TSDeclareFunction",
	"TSMethodSignature",
	":matches(TSFunctionType:not(TSTypeAnnotation > TSFunctionType), VariableDeclarator > Identifier > TSTypeAnnotation > TSFunctionType)",
];

/** Body-less signatures need explicit result checks because the plugin cannot infer their returns. */
const SIGNATURES =
	":matches(TSEmptyBodyFunctionExpression, TSCallSignatureDeclaration, TSConstructSignatureDeclaration, TSConstructorType)";

/** Check function-typed fields on their documented owner, including abstract and constructor-valued fields. */
const FUNCTION_FIELDS =
	":matches(PropertyDefinition, TSAbstractPropertyDefinition, AccessorProperty, TSAbstractAccessorProperty, TSPropertySignature)[typeAnnotation.typeAnnotation.type=/^TS(Function|Constructor)Type$/]";

/**
 * Build documentation coverage without changing the rules for comments that are present.
 * @param publicOnly - Whether to require documentation only for the exported surface.
 * @returns Lint fragments for production and test files.
 */
export function createDocumentationConfig(publicOnly = DOCUMENT_PUBLIC_ONLY) {
	return defineConfig(
		{
			files: ["**/*.{js,mjs,cjs,ts,mts,tsx,cts}"],
			extends: [jsdoc.configs["flat/recommended-tsdoc-error"]],
			plugins: { "@stylistic": stylistic },
			rules: {
				"@stylistic/lines-around-comment": [
					"error",
					{
						beforeBlockComment: true,
						ignorePattern: "^(?!\\*)",
						allowBlockStart: true,
						allowClassStart: true,
						allowObjectStart: true,
						allowArrayStart: true,
						allowInterfaceStart: true,
						allowTypeStart: true,
						allowEnumStart: true,
						allowModuleStart: true,
					},
				],
				"jsdoc/check-syntax": "error",
				"jsdoc/informative-docs": "error",
				"jsdoc/require-jsdoc": [
					"error",
					{
						contexts: [declarations(publicOnly), CLASS_PROPERTIES, ":matches(Program, TSModuleBlock) > VariableDeclaration"],
						publicOnly,
						skipInterveningOverloadedDeclarations: false,
						require: { FunctionDeclaration: true, ClassDeclaration: true, ClassExpression: true },
					},
				],
				"jsdoc/check-param-names": ["error", { checkDestructured: false }],
				"jsdoc/require-param": [
					"error",
					{ contexts: [...functionContexts, SIGNATURES, FUNCTION_FIELDS], checkSetters: true, checkDestructured: false },
				],
				"jsdoc/require-returns": [
					"error",
					{
						contexts: [
							...functionContexts,
							{
								context: `${SIGNATURES}[returnType]:not([returnType.typeAnnotation.type=/^TS(Void|Undefined|Never)Keyword$/])`,
								forceRequireReturn: true,
							},
							{
								context: `${FUNCTION_FIELDS}:not([typeAnnotation.typeAnnotation.returnType.typeAnnotation.type=/^TS(Void|Undefined|Never)Keyword$/])`,
								forceRequireReturn: true,
							},
						],
					},
				],
				"jsdoc/require-description": ["error", { contexts: ["any"] }],
				"jsdoc/require-param-description": ["error", { contexts: ["any"] }],
				"jsdoc/require-returns-description": ["error", { contexts: ["any"] }],
				"jsdoc/no-restricted-syntax": [
					"error",
					{
						contexts: [
							{
								context: "any",
								comment: 'JsdocBlock:has(JsdocTag[rawType!=""]:not([rawType=/^@link/]))',
								message: "Keep types in TypeScript declarations, not JSDoc tags.",
							},
						],
					},
				],
				"jsdoc/require-throws": "error",
				"jsdoc/require-throws-description": "error",
				"jsdoc/require-yields-description": "error",
			},
		},
		{
			files: ["**/*.test.{js,mjs,cjs,ts,mts,tsx,cts}"],
			rules: {
				"jsdoc/require-jsdoc": "off",
			},
		},
	);
}

/** Check JSDoc against the documentation conventions in CONTRIBUTING.md. */
export const documentationConfig = createDocumentationConfig();
