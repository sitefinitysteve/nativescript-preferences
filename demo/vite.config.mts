import { defineConfig } from 'vite';
import { typescriptConfig } from '@nativescript/vite/typescript';

export default defineConfig(({ mode }) => typescriptConfig({ mode }));
