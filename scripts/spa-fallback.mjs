// GitHub Pages has no rewrite rules: serving index.html as 404.html makes deep links
// such as /gstlst/u/daniel boot the SPA, which then routes on the client.
import { copyFileSync } from 'node:fs'

copyFileSync('dist/index.html', 'dist/404.html')
