import path from 'node:path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
    output: process.env.MFR_DESKTOP_BUILD === '1' ? 'standalone' : undefined,
    outputFileTracingRoot: path.resolve(__dirname, '../..'),
};

export default nextConfig;
