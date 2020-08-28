module.exports = {
  entry: {
    main: './main.js', // webpack的入口文件
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['@babel/preset-env'],
            plugins: [[
              '@babel/plugin-transform-react-jsx', 
              { 
                pragma: 'ToyReact.createElement',
                pragmaFrag: 'ToyReact.Fragment',
              },
            ]]
          }
        }
      }
    ]
  },
  mode: "development",
  optimization: {
    minimize: false, // 打包后的main.js是否要压缩
  }
};
