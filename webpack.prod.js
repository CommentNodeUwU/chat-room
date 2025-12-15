import CopyPlugin from "copy-webpack-plugin"

export default {
    extends: './webpack.config.js',
    mode: 'production',
    devtool: 'source-map',
    plugins: [
        new CopyPlugin({
            patterns: [
                {
                    from: 'assets'
                }
            ]
        }),
    ]
};
