/**
 * Generate ttyd's `src/html.h` from the single-file build.
 *
 * ttyd's `src/http.c` includes this header and serves `index_html` directly as a gzip response
 * body, inflating it to `index_html_size` bytes when the client does not accept gzip.
 */
import { readFile, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'

const input = process.argv[2] ?? 'dist/index.html'
const output = process.argv[3] ?? 'dist/html.h'

const html = await readFile(input)
const gzipped = gzipSync(html, { level: 9 })

const lines = []
for (let i = 0; i < gzipped.length; i += 12) {
  const bytes = Array.from(
    gzipped.subarray(i, i + 12),
    (b) => `0x${b.toString(16).padStart(2, '0')}`
  )
  lines.push(`  ${bytes.join(', ')}`)
}

const header = `unsigned char index_html[] = {
${lines.join(',\n')}
};
unsigned int index_html_len = ${gzipped.length};
unsigned int index_html_size = ${html.length};
`

await writeFile(output, header)
console.log(`${output}: ${gzipped.length} bytes gzipped, ${html.length} bytes raw`)
