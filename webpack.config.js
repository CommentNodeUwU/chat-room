import path from 'path';
import { fileURLToPath } from 'url';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import config from './config.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default {
    mode: 'development',
    entry: ['./src/client/index.ts'],
    devtool: 'eval-cheap-source-map',
    resolve: {
        extensions: ['.ts', '.js'],
        extensionAlias: {
            '.js': ['.js', '.ts'],
            '.cjs': ['.cjs', '.cts'],
            '.mjs': ['.mjs', '.mts'],
        },
    },
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist', 'client'),
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: [
                    {
                        loader: 'ts-loader',
                        options: {
                            configFile: 'tsconfig.client.json'
                        }
                    }
                ],
            },
            {
                test: /\.css$/,
                use: [
                    'style-loader',
                    'css-loader',
                ],
            },
            {
                test: /\.s[ac]ss$/,
                use: [
                    'style-loader',
                    'css-loader',
                    'sass-loader',
                ]
            },
        ],
    },
    devServer: {
        port: config.port + 1,
        hot: true,
        compress: true,
        allowedHosts: 'all',
        static: { 
            directory: path.resolve(__dirname, 'assets'), 
            publicPath: '/assets'
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: './src/client/index.html',
        }),
    ],
};
