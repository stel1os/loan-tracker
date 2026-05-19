const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const version = pkg.version;

const css = fs.readFileSync('src/style.css', 'utf8');
const js = [
  fs.readFileSync('src/engine.js', 'utf8'),
  fs.readFileSync('src/storage.js', 'utf8'),
  fs.readFileSync('src/ui.js', 'utf8'),
].join('\n');

let html = fs.readFileSync('src/index.html', 'utf8');
html = html.replace('<!-- STYLE -->', '<style>\n' + css + '\n</style>');
html = html.replace('<!-- SCRIPTS -->', '<script>\n' + js + '\n</script>');
html = html.replace('__APP_VERSION__', 'v' + version);

fs.writeFileSync('loan-tracker.html', html, 'utf8');
console.log('Built loan-tracker.html (v' + version + ')');
