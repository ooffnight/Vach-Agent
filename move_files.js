const fs = require('fs');
const path = require('path');

const root = __dirname;
const publicDir = path.join(root, 'public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir);
}

const foldersToMove = ['css', 'js', 'images'];
const filesToMove = ['index.html', 'admin.html'];

for (const item of [...foldersToMove, ...filesToMove]) {
  const oldPath = path.join(root, item);
  const newPath = path.join(publicDir, item);
  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, newPath);
    console.log(`Moved ${item} to public/`);
  } else {
    console.log(`${item} not found`);
  }
}
