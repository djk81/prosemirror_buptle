import babel from 'rollup-plugin-babel';
import buble from 'rollup-plugin-buble';
import eslint from 'rollup-plugin-eslint';
import resolve from 'rollup-plugin-node-resolve';
import commonJS from 'rollup-plugin-commonjs'


export default {
    input: './src/index.js',
    output: {
        format: 'umd',
        file: 'dist/buptle_editor.js',
        name: 'ProseMirror'
    },
    plugins: [
        babel(),
        resolve({
            jsnext: true,
            browser: true
        }),
        buble(),
        commonJS({
            include: 'node_modules/**'
        }),
    ],
};