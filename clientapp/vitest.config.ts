// @ts-nocheck
import { defineConfig, configDefaults } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        setupFiles: ["./src/test/setup.ts"],
        css: true,
        globals: true,

        // Sadece kendi testlerini çalıştır
        include: ["src/**/*.{test,spec}.{ts,tsx,js,jsx}"],
        exclude: [...configDefaults.exclude, "src/test/**"],

        // CI/Windows için stabil timeout
        testTimeout: 10000,

        // Kapsam (coverage) -> DİKKAT: test bloğunun içinde
        coverage: {
            provider: "v8",
            reporter: ["text", "html", "lcov"],
            reportsDirectory: "./coverage",
            lines: 70, functions: 70, statements: 70, branches: 60,

            // Hangi kaynak dosyaları ölçülecek
            include: ["src/**/*.{ts,tsx}"],

            // Ölçümden hariç tut
            exclude: [
                "src/test/**",
                "src/**/__mocks__/**",
                "src/**/*.d.ts",
                "**/*.{test,spec}.{ts,tsx,js,jsx}",
                // CRA dosyaları
                "src/index.tsx",
                "src/react-app-env.d.ts",
                "src/reportWebVitals.ts",
                "src/setupTests.ts"
            ],
        },
    },
});
