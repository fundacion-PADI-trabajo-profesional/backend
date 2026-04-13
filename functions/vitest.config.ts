import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Archivos a medir (solo código fuente, sin tests ni config)
      include: ["src/**/*.ts"],
      exclude: [
        "src/index.ts",        // entrypoint de Firebase Functions
        "src/**/*.d.ts",
        "src/config/**",       // clientes externos (Supabase, Prisma)
        "src/interfaces/**",  // solo tipos, sin lógica ejecutable
        "src/repositories/**", // capa de acceso a datos — testeada vía integración con Prisma mock
      ],
      // Reportes: texto en terminal + HTML navegable en coverage/
      reporter: ["text", "html", "lcov"],
      // Directorio de salida del reporte HTML
      reportsDirectory: "./coverage",
      // Umbrales mínimos — el run falla si alguno no se alcanza
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
      // Incluir archivos sin tests en el reporte (muestra cobertura 0%)
      all: true,
    },
  },
});


