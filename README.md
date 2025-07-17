Default .env file:

```dotenv
PORT=8080
DATABASE=bans
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_USER=user
DATABASE_PASSWORD=password
SWAGGER_HOST=localhost:8080
```

`SWAGGER_HOST` - host for api on /swagger page

`npm run swagger` - generate swagger


## start
`run.sh` - test, and run in docker compose

`run.sh -skip-test` - ignore tests, just run

`run.sh -pm2` - run via pm2, not docker


## stop
`stop.sh` - stop docker compose

`stop.sh -pm2` - stop pm2