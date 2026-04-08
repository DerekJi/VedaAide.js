import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      include: ["src/lib/**/*.ts"],
      exclude: [
        "src/app/**",
        "src/**/*.test.ts",
        // Pure type/config files — no runtime logic to cover
        "src/lib/types.ts",
        "src/lib/db.ts",
        "src/lib/vector-store/vector-store.ts",
        // React Query hooks — require browser / JSX environment
        "src/lib/queries/**",
        // External connectors requiring live credentials (covered by integration tests)
        "src/lib/services/azure-openai-chat.service.ts",
        "src/lib/services/blob-storage.connector.ts",
        "src/lib/services/cosmos-db.connector.ts",
        "src/lib/datasources/file-system.connector.ts",
      ],
    },
  },
});
