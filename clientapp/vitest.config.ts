// @ts-nocheck
import { defineConfig, configDefaults } from "vitest/config";

const isCI = process.env.CI === "true";

export default defineConfig({
    test: {
        environment: "jsdom",
        environmentOptions: {
            jsdom: { url: "http://localhost" },
        },
        setupFiles: ["./src/test/setup.ts"],
        css: true,
        globals: true,

        include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
        exclude: [...configDefaults.exclude, "src/test/**"],

        testTimeout: 10_000,

        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            reportsDirectory: "./coverage",

            // CI'da %80, localde %70
            lines: isCI ? 80 : 70,
            functions: isCI ? 80 : 70,
            statements: isCI ? 80 : 70,
            branches: isCI ? 70 : 60,

            include: ["src/**/*.{ts,tsx}"],

            exclude: [
                "src/test/**",
                "src/**/__mocks__/**",
                "src/**/*.d.ts",
                "**/*.{test,spec}.{ts,tsx,js,jsx}",
                "src/index.tsx",
                "src/react-app-env.d.ts",
                "src/reportWebVitals.ts",
                "src/setupTests.ts",
            ],
        },
    },
});