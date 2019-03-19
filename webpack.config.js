var path = require('path');
var webpack = require('webpack');

module.exports = {
  context: path.resolve(__dirname, 'src'),
  entry: './clickstream.js',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'clickstream.bundle.js',
    library: 'Clickstream',
    libraryTarget: 'umd',
    umdNamedDefine: true
  },
  module: {
    loaders: [
      {
        test: /\.jsx?$/,
        include: [
          path.join(__dirname, 'src'),
          path.join(__dirname, 'tests'),
          path.join(__dirname, 'node_modules/react-native-storage'),
          path.join(__dirname, 'node_modules/react-native-joi'),
          path.join(__dirname, 'node_modules/ipify'),
          path.join(__dirname, 'node_modules/got')
        ],
        loader: 'babel-loader?presets=react-native'
      }
    ]
  },
  plugins: [
    new webpack.IgnorePlugin(/locale/)
  ]
};
