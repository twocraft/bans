TEST_FLAG=true
DOCKER_FLAG=true

while [[ $# -gt 0 ]]; do
  case "$1" in
    -skip-test)
      TEST_FLAG=false
      shift
      ;;
    -pm2)
      DOCKER_FLAG=false
      shift
      ;;
    *)
      echo "Undefined flag: $1"
      exit 1
      ;;
  esac
done

if $TEST_FLAG; then
  echo "Running tests"
  docker compose -p bans-tests -f test-compose.yaml down
  docker compose -p bans-tests -f test-compose.yaml up --build --attach app --exit-code-from app

  EXIT_CODE=$?

  docker compose -p bans-tests -f test-compose.yaml down

  if [ $EXIT_CODE -ne 0 ]; then
      echo "Tests failed! Code: $EXIT_CODE"
      exit 1
  else
      echo "Tests passed"
  fi
fi

if $DOCKER_FLAG; then
  docker compose -p bans -f compose.yaml up --build --detach
else
  npm run swagger
  pm2 restart ecosystem.config.js
fi