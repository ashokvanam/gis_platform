const path = require('path')

export default {

  root: path.resolve(__dirname, 'src'),
  resolve: {
    alias: {
      '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
      '~ol': path.resolve(__dirname, 'node_modules/ol'),
      '~fontawesome': path.resolve(__dirname, 'node_modules/@fortawesome'),
      '~node_modules': path.resolve(__dirname, 'node_modules'),
    }
  },
  
  server: {
    port: 8080,
    hot: true
  },
  build: {
    sourcemap: true,
  }
}
