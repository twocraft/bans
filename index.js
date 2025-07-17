require('dotenv', { override: true, quiet: true }).config();

const db = require('./dba');

(async function () {
    await db.init();

    const app = require("./app").createApp(db.pool);

    const port = process.env.PORT || 3000;
    app.listen(port, () => {
        console.log(`Server running on port: ${port}`);
    });
})();
