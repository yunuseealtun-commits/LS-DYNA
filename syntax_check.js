const fs = require('fs');
const babel = require('@babel/core');

const code = fs.readFileSync('index.html', 'utf8');
const match = code.match(/<script type="text\/babel" data-type="module">([\s\S]*?)<\/script>/);

if (match && match[1]) {
    try {
        babel.transformSync(match[1], { presets: ['@babel/preset-react'] });
        console.log("SYNTAX OK!");
    } catch (e) {
        console.error("BABEL ERROR:", e.message);
    }
} else {
    console.error("No babel script tag found.");
}
