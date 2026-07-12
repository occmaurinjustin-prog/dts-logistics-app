const sharp = require('sharp');
const fs = require('fs');

async function run() {
  const input = 'assets/images/dtslogo.png';
  if (!fs.existsSync(input)) {
    console.error('dtslogo.png not found!');
    return;
  }
  try {
    await sharp(input).resize(1024, 1024, {fit:'contain', background:{r:255,g:255,b:255,alpha:0}}).png().toFile('assets/images/icon.png');
    await sharp(input).resize(432, 432, {fit:'contain', background:{r:255,g:255,b:255,alpha:0}}).png().toFile('assets/images/android-icon-foreground.png');
    await sharp(input).resize(1024, 1024, {fit:'contain', background:{r:255,g:255,b:255,alpha:0}}).png().toFile('assets/images/splash-icon.png');
    console.log('Icons Resized Successfully!');
  } catch(e) {
    console.error('Error resizing:', e);
  }
}
run();
