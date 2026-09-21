const fs = require('fs');
const path = require('path');

const directory = 'C:\\Users\\Usuario\\Downloads\\sudi';

function processDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        if (file === 'sudi' && dir === directory) continue; // skip nested sudi
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            processDir(fullPath);
        } else if (file.endsWith('.html')) {
            let content = fs.readFileSync(fullPath, 'utf8');
            let original = content;
            
            content = content.replace(/document\.getElementById\('sidebar-toggle'\)/g, "document.getElementById('INLINE-DISABLED-sidebar-toggle')");

            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Disabled inline script in:', fullPath);
            }
        }
    }
}
processDir(directory);
