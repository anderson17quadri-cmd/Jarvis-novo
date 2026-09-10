import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri/target', 'src-tauri/gen', 'design-reference', 'scripts', '.claude/worktrees'] },

  {
    extends: [js.configs.recommended, ...tseslint.configs.recommendedTypeChecked],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        project: ['./tsconfig.json', './tsconfig.node.json'],
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],

      /*
       * A regra de ouro do projeto: `any` é proibido, e nada entra no código
       * por uma porta lateral não tipada.
       */
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unsafe-assignment': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-argument': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' },
      ],

      /*
       * Um `catch {}` vazio é o padrão da degradação suave neste projeto — o
       * adapter engole a falha de propósito. Continua a ser preciso explicá-lo
       * num comentário, e é isso que a revisão verifica; a regra automática só
       * gerava ruído.
       */
      'no-empty': ['error', { allowEmptyCatch: true }],

      /*
       * Desligadas por serem estilísticas e de alto ruído neste código:
       * `() => setAberto(false)` num handler é legível e correto, e interpolar
       * números em template literals é o que o `formatBytes` faz o dia inteiro.
       */
      '@typescript-eslint/no-confusing-void-expression': 'off',
      '@typescript-eslint/restrict-template-expressions': 'off',

      /*
       * Os métodos do `PlatformAdapter` são `async` por contrato, mesmo quando
       * a implementação de uma plataforma não tem nada para esperar. Uniformizar
       * a assinatura é o que permite trocar de adapter sem mudar quem chama.
       */
      '@typescript-eslint/require-await': 'off',

      /*
       * Regras do React Compiler. Ficam como aviso: disparam em padrões
       * legítimos deste código — estado sincronizado a partir de temporizadores
       * e de eventos externos — mas continuam úteis a apontar efeitos suspeitos.
       */
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/refs': 'warn',
    },
  },

  {
    /*
     * Nos testes, `expect(x![0])` é o idioma normal: o próprio teste falha se o
     * valor for nulo, e obrigar a verificações defensivas só tornaria as
     * asserções mais difíceis de ler.
     */
    files: ['tests/**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
    },
  },
);
