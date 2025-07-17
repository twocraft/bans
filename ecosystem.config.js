require('dotenv').config({ path: '.env', override: true })

module.exports = {
    apps: [{
        name: 'bans',
        script: 'index.js'
    }]
}
