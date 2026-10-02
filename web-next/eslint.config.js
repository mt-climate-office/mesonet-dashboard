// ESLint flat config: typescript-eslint recommended, plus the two layer rules
// from ARCHITECTURE.md that a linter can enforce.
import tseslint from 'typescript-eslint'

const layer = (from, banned, why) => ({
  files: [`src/${from}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [{ group: banned, message: why }],
        paths: [
          {
            name: 'maplibre-gl',
            allowTypeImports: true,
            message: 'MapLibre loads from the kit-pinned CDN; use the `maplibregl` global (types only here).',
          },
        ],
      },
    ],
  },
})

export default tseslint.config(
  { ignores: ['dist', 'dist-pages', 'node_modules', 'src/core/api/openapi.d.ts'] },
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'maplibre-gl',
              allowTypeImports: true,
              message: 'MapLibre loads from the kit-pinned CDN; use the `maplibregl` global (types only here).',
            },
          ],
        },
      ],
    },
  },
  // Imports go one way: core → stores → ui.
  layer('core', ['**/stores/**', '**/ui/**', 'alpinejs'], 'core/ is pure: no stores, ui or Alpine.'),
  layer('stores', ['**/ui/**'], 'stores/ must not import ui/.'),
)
