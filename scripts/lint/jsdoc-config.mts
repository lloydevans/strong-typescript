import { defineConfig } from "eslint/config";
import jsdoc from "eslint-plugin-jsdoc";
import stylistic from "@stylistic/eslint-plugin";

/** false covers the listed declarations; true delegates to the plugin's publicOnly option. */
const documentPublicOnly = false;

/** Inline function arguments and JSX attribute handlers need no separate documentation. */
const inlineCallbacks =
	":matches(:matches(CallExpression, NewExpression) > :matches(FunctionExpression, ArrowFunctionExpression).arguments, JSXAttribute > JSXExpressionContainer > :matches(FunctionExpression, ArrowFunctionExpression))";

/** An object's declared type documents function-valued properties; accessors still need their own documentation. */
const objectFunctions = 'ObjectExpression > Property[kind="init"] > :matches(FunctionExpression, ArrowFunctionExpression).value';

/** A function variable is documented by its declaration or enclosing function. */
const variableFunctions = "VariableDeclarator > :matches(FunctionExpression, ArrowFunctionExpression).init";

/** Require comments on class fields. */
const classProperties =
	":matches(PropertyDefinition, TSAbstractPropertyDefinition, AccessorProperty, TSAbstractAccessorProperty)";

/** Select callables whose parameter and return types own their documentation. */
const documentedFunctions = `:matches(:function, TSDeclareFunction, TSEmptyBodyFunctionExpression):not(${inlineCallbacks}):not(${objectFunctions}):not(${variableFunctions})`;

/** Enter declared types without entering initializers or function bodies. */
const declaredTypes = `:matches(TSTypeAliasDeclaration, TSInterfaceDeclaration, ClassBody > TSIndexSignature, ${classProperties} > TSTypeAnnotation, :matches(ClassDeclaration, ClassExpression, ${documentedFunctions}) > :matches(TSTypeAnnotation, TSTypeParameterDeclaration, TSTypeParameterInstantiation, TSClassImplements), ${documentedFunctions} > *.params > TSTypeAnnotation, ${documentedFunctions} > AssignmentPattern.params > *.left > TSTypeAnnotation, :matches(Program, TSModuleBlock, ExportNamedDeclaration) > VariableDeclaration > VariableDeclarator > *.id > TSTypeAnnotation)`;

/** Document members at every type depth, except conditional matching patterns. */
const typeMembers = `:matches(ClassBody, TSInterfaceBody, ${declaredTypes} TSTypeLiteral) > :matches(TSMethodSignature, TSPropertySignature, TSCallSignatureDeclaration, TSConstructSignatureDeclaration, TSIndexSignature):not(TSConditionalType > *.extendsType *)`;

/** Cover declarations and named-type members; re-exports are documented at their source. */
const declarations = `:matches(FunctionExpression, ArrowFunctionExpression, MethodDefinition, TSAbstractMethodDefinition, TSDeclareFunction, TSInterfaceDeclaration, TSTypeAliasDeclaration, TSEnumDeclaration, TSEnumMember, TSModuleDeclaration:not(ExportNamedDeclaration > TSModuleDeclaration), ExportNamedDeclaration:not([source]), ExportDefaultDeclaration, TSExportAssignment, TSNamespaceExportDeclaration, ${typeMembers}):not(${inlineCallbacks}):not(${objectFunctions}):not(${variableFunctions})`;

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
const signatures =
	":matches(TSEmptyBodyFunctionExpression, TSCallSignatureDeclaration, TSConstructSignatureDeclaration, TSConstructorType)";

/** Check function-typed fields on their documented owner, including abstract and constructor-valued fields. */
const functionFields =
	":matches(PropertyDefinition, TSAbstractPropertyDefinition, AccessorProperty, TSAbstractAccessorProperty, TSPropertySignature)[typeAnnotation.typeAnnotation.type=/^TS(Function|Constructor)Type$/]";

/**
 * Build documentation coverage without changing the rules for comments that are present.
 * @param publicOnly - Whether to require documentation only for the exported surface.
 * @returns Lint fragments for production and test files.
 */
export function createDocumentationConfig(publicOnly = documentPublicOnly) {
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
						contexts: [declarations, classProperties, ":matches(Program, TSModuleBlock) > VariableDeclaration"],
						publicOnly,
						skipInterveningOverloadedDeclarations: false,
						require: { FunctionDeclaration: true, ClassDeclaration: true, ClassExpression: true },
					},
				],
				"jsdoc/check-param-names": ["error", { checkDestructured: false }],
				"jsdoc/require-param": [
					"error",
					{ contexts: [...functionContexts, signatures, functionFields], checkSetters: true, checkDestructured: false },
				],
				"jsdoc/require-returns": [
					"error",
					{
						contexts: [
							...functionContexts,
							{
								context: `${signatures}[returnType]:not([returnType.typeAnnotation.type=/^TS(Void|Undefined|Never)Keyword$/])`,
								forceRequireReturn: true,
							},
							{
								context: `${functionFields}:not([typeAnnotation.typeAnnotation.returnType.typeAnnotation.type=/^TS(Void|Undefined|Never)Keyword$/])`,
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
