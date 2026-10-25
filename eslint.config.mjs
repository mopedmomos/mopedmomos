import { defineConfig, globalIgnores } from 'eslint/config';
import next from 'eslint-config-next/core-web-vitals';
import ts from 'eslint-config-next/typescript';
export default defineConfig([...next,...ts,globalIgnores(['.next/**','preview/**','next-env.d.ts','mobile/**']), {rules:{'@next/next/no-img-element':'off','react-hooks/set-state-in-effect':'off','@next/next/no-location-assign-relative-destination':'off'}}]);
