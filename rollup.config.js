import replace from '@rollup/plugin-replace';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import { terser } from 'rollup-plugin-terser';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export default [
    // UMD Build for Browsers
    {
        input: 'src/index.js',
        output: {
            file: 'dist/iselfie-cardio-sdk.umd.min.js',
            format: 'umd',
            name: 'ISelfieCardioSDK', // Global variable for browser usage
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
                'process.env.FRONTEND_DEV_URL': JSON.stringify(process.env.FRONTEND_DEV_URL),
                'process.env.BACKEND_DEV_URL': JSON.stringify(process.env.BACKEND_DEV_URL),
            }),
            terser(), // Minify UMD build
        ],
    },
    // ESM Build for Modern Frameworks
    {
        input: 'src/index.js',
        output: {
            file: 'dist/iselfie-cardio-sdk.esm.js',
            format: 'es',
            sourcemap: true,
        },
        plugins: [
            resolve(),
            commonjs(),
            json(),
            replace({
                preventAssignment: true,
                'process.env.FRONTEND_URL': JSON.stringify(process.env.FRONTEND_URL),
                'process.env.BACKEND_URL': JSON.stringify(process.env.BACKEND_URL),
                'process.env.FRONTEND_DEV_URL': JSON.stringify(process.env.FRONTEND_DEV_URL),
                'process.env.BACKEND_DEV_URL': JSON.stringify(process.env.BACKEND_DEV_URL),
            }),
        ],
    }
];
