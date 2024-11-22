import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default {
    input: 'src/index.js',
    output: {
        file: 'dist/iselfie-cardio-sdk.js',
        format: 'umd',
        name: 'iSelfie Cardio Test SDK',
        sourcemap: true,
    },
    plugins: [
        resolve(),
        commonjs(),
        json(),
        replace({
            preventAssignment: true,
            // Inject .env variables into the build
            'process.env.FRONTEND_URL': JSON.stringify(process.env.FRONTEND_URL),
            'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL),
            //Dev environment
            'process.env.FRONTEND_DEV_URL': JSON.stringify(process.env.FRONTEND_DEV_URL),
            'process.env.BACKEND_DEV_URL': JSON.stringify(process.env.BACKEND_DEV_URL),
        }),
        terser(),
    ],
};
