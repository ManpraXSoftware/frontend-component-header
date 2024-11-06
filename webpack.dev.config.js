const path = require('path');
const { createConfig } = require('@openedx/frontend-build');

module.exports = createConfig('webpack-dev', {
  entry: path.resolve(__dirname, 'example'), // Adjust this to your entry file or folder

  output: {
    path: path.resolve(__dirname, 'public'), // Serve from the public folder or use src for direct development
    filename: 'bundle.js', // Output file name
    publicPath: '/', // Adjust if serving from a subfolder
  },

  resolve: {
    alias: {
      '@edx/frontend-component-header': path.resolve(__dirname, 'src'), // Alias to source directly
    },
    extensions: ['.js', '.jsx', '.ts', '.tsx'], // Ensure proper file extensions are resolved
  },

  // Optional: Configure dev server if needed for live reloading and hot module replacement
  devServer: {
    static: path.resolve(__dirname, 'public'), // Static folder for serving files
    hot: true, // Enable hot module replacement
    open: true, // Automatically open the browser
    port: 3000, // Port for the dev server
  },

  // Optional: Enable source maps for debugging
  devtool: 'inline-source-map',
});
