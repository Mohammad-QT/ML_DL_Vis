// The site's own copy of every lesson notebook, so "Download notebook" is same-origin (the download
// attribute works) and the file is available offline once cached.
import type { APIRoute, GetStaticPaths } from 'astro';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { LESSONS } from '../../course';

export const getStaticPaths = (() =>
  LESSONS.map(l => ({ params: { nb: l.notebook.replace(/^notebooks\//, '') } }))) satisfies GetStaticPaths;

export const GET: APIRoute = async ({ params }) =>
  new Response(await readFile(join(process.cwd(), 'notebooks', String(params.nb))), {
    headers: { 'Content-Type': 'application/x-ipynb+json' },
  });
