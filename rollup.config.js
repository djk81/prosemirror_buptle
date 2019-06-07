import babel from 'rollup-plugin-babel';
import resolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs'


export default {
  input: './src/index.js',
  output: {
    format: 'iife',
    file: 'deploy/buptle_ProseMirror.js',
    name: 'ProseMirror'
  },
  plugins: [
      babel(),
      resolve(),
      commonJS({
        include: 'node_modules/**'
      })
    ],
};