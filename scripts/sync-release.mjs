import fs from 'node:fs'
import path from 'node:path'

const srcDir = path.resolve('dist-win', 'win-unpacked')
const destDir = path.resolve('release', 'win-unpacked')

if (fs.existsSync(srcDir)) {
  console.log('\n[NotionFlow Build] Unpacked production build ready at: dist-win\\win-unpacked\\NotionFlow.exe')
}
