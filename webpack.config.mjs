import path from "path";
import HtmlWebpackPlugin from "html-webpack-plugin";

export default (env = {}) => {
	/**
	 * Build options.
	 */
	env = { ...{ prod: false }, ...env };

	/**
	 * @type {import("webpack").Configuration}
	 */
	const config = {
		entry: "./src/index.ts",

		output: {
			filename: "bundle.js",
			path: path.join(import.meta.dirname, "build"),
			clean: true,
		},

		devtool: env.prod ? "source-map" : "eval-source-map",

		cache: {
			type: "filesystem",
		},

		module: {
			rules: [
				{
					test: /\.css$/i,
					use: ["style-loader", "css-loader"],
				},
				{
					test: /\.tsx?$/,
					loader: "ts-loader",
				},
			],
		},

		resolve: {
			extensions: [".tsx", ".ts", ".js", ".css"],
		},

		plugins: [
			// Auto generate HTML
			new HtmlWebpackPlugin({ title: "TypeScript template" }),
		],

		mode: env.prod ? "production" : "development",
	};

	return config;
};
