// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    ignores: ["src/app/themeswitcher.ts"],
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          format: ["snake_case", "UPPER_CASE"],
          leadingUnderscore: "allow",
        },
        {
          selector: "parameter",
          format: ["snake_case"],
          leadingUnderscore: "allow",
        },
        {
          selector: "classProperty",
          format: ["snake_case", "UPPER_CASE"],
          leadingUnderscore: "allow",
          filter: {
            // Allow Angular lifecycle hooks
            regex: "^(exChange)$",
            match: false,
          },
        },
        {
          selector: "classMethod",
          format: ["snake_case"],
          filter: {
            // Allow Angular lifecycle hooks
            regex: "^(ngOnInit|ngOnDestroy|ngOnChanges|ngAfterViewInit|ngAfterContentInit|ngAfterViewChecked|ngAfterContentChecked|ngDoCheck)$",
            match: false,
          },
        },
        {
          selector: "typeAlias",
          format: ["PascalCase"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
        },
        {
          selector: "enum",
          format: ["PascalCase"],
        },
        {
          selector: "enumMember",
          format: ["UPPER_CASE"],
        },
      ],
      "@typescript-eslint/no-explicit-any": "off",
      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {},
  }
]);
