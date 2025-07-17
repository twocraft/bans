DOCKER_FLAG=true

while [[ $# -gt 0 ]]; do
  case "$1" in
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

if $DOCKER_FLAG; then
  docker compose -p bans -f compose.yaml down
else
  pm2 stop ecosystem.config.js
fi