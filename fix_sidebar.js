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
            
            let index = content.indexOf("getElementById('sidebar-toggle')");
            while (index !== -1) {
                let start = content.lastIndexOf('\n', index);
                
                let prevCommentStart = content.lastIndexOf('//', start);
                if (prevCommentStart !== -1 && prevCommentStart > start - 100) {
                    let prevNewLine = content.lastIndexOf('\n', prevCommentStart);
                    if (prevNewLine !== -1) start = prevNewLine;
                }
                
                let blockEnds = [
                    "overlay.addEventListener('click', close);\r\n            }",
                    "overlay.addEventListener('click', close);\n            }",
                    "overlay.addEventListener('click', close);",
                    "sidebarOverlay.classList.add('hidden');\r\n                });\r\n            }",
                    "sidebarOverlay.classList.add('hidden');\n                });\n            }",
                    "sidebarOverlay.addEventListener('click', toggleSidebar);",
                    "sidebarOverlay.classList.add('hidden');\r\n                        });\r\n                    }",
                    "sidebarOverlay.classList.add('hidden');\n                        });\n                    }"
                ];
                
                let end = -1;
                for (let blockEnd of blockEnds) {
                    let e = content.indexOf(blockEnd, start);
                    if (e !== -1 && (end === -1 || e < end)) {
                        end = e + blockEnd.length;
                    }
                }
                
                if (end !== -1) {
                    content = content.substring(0, start) + '\n' + content.substring(end);
                } else {
                    console.log('Could not find end of block in', fullPath);
                    break;
                }
                index = content.indexOf("getElementById('sidebar-toggle')");
            }

            if (content !== original) {
                fs.writeFileSync(fullPath, content);
                console.log('Fixed:', fullPath);
            }
        }
    }
}
processDir(directory);
