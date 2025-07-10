import path from "path";
import { fileURLToPath } from 'url';
import webpack from "webpack";
import HtmlWebpackPlugin from "html-webpack-plugin";
import ForkTsCheckerWebpackPlugin from "fork-ts-checker-webpack-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type Configuration = webpack.Configuration;

const isProd = process.env.NODE_ENV === "production";
const repoBase = isProd ? "/anime-foliage/" : "/";

const config: Configuration = {
  entry: "./src/index.tsx",
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "main.js",
    publicPath: repoBase,           // ← this makes all assets load from /anime-foliage/ in prod
    clean: true,
  },
  resolve: { extensions: [".tsx", ".ts", ".js"] },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        exclude: /node_modules/,
        use: [
          { loader: "ts-loader", options: { transpileOnly: true } },
          { loader: "babel-loader", options: {
              presets: [
                ["@babel/preset-env",{ modules: false }],
                ["@babel/preset-react",{ runtime: "automatic" }],
                "@babel/preset-typescript"
              ],
              plugins: [["babel-plugin-reactylon"]]
            }
          }
        ]
      },
      { test: /\.css$/, use: ["style-loader","css-loader"] },
      { test: /\.(png|jpe?g|glb|gltf|wasm)$/, type: "asset/resource" }
    ]
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.PUBLIC_URL": JSON.stringify(repoBase.slice(0,-1)),
    }),
    new webpack.ProvidePlugin({
      process: "process/browser"  // ← polyfill `process`
    }),
    new HtmlWebpackPlugin({
      template: "public/index.html",
      templateParameters: { BASE_HREF: repoBase }
    }),
    new ForkTsCheckerWebpackPlugin()
  ],
  devServer: {
    static: path.join(__dirname,"public"),
    historyApiFallback: true,
    hot: true,
    port: 3000
  }
};

export default config;