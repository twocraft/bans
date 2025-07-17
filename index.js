require('dotenv', { override: true, quiet: true }).config();

const db = require('./dba');

(async function () {
    await db.init();

    const app = require("./app").createApp(db.pool);

    const port = process.env.PORT || 3000;
    const host = process.env.HOST || '0.0.0.0';
    app.listen(port, host, () => {
        console.log(`Server running on port: ${port}`);
    });
})();
