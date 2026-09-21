const { generate } = require('youtube-po-token-generator');

generate().then(result => {
    console.log(JSON.stringify(result));
}).catch(console.error);
