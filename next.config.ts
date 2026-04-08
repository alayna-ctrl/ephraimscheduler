import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Keeps serverless file tracing inside this repo (avoids wrong root when multiple lockfiles exist).
  outputFileTracingRoot: path.join(process.cwd()),
};

export default nextConfig;
