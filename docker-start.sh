#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Gatewayz Backend - Docker Services Manager${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"

case "$1" in
    start)
        echo -e "\n${YELLOW}🚀 Starting Docker services...${NC}"
        docker-compose up -d

        echo -e "\n${YELLOW}⏳ Waiting for services to be ready...${NC}"
        sleep 3

        echo -e "\n${YELLOW}📊 Service Status:${NC}"
        docker-compose ps

        echo -e "\n${GREEN}✅ Services started!${NC}"
        echo -e "${YELLOW}PostgreSQL:${NC} localhost:5432"
        echo -e "${YELLOW}Redis:${NC} localhost:6379"
        echo -e "\n${YELLOW}💡 Test connection:${NC} python test_connections.py"
        ;;

    stop)
        echo -e "\n${YELLOW}🛑 Stopping Docker services...${NC}"
        docker-compose stop
        echo -e "${GREEN}✅ Services stopped${NC}"
        ;;

    down)
        echo -e "\n${YELLOW}🗑️  Stopping and removing containers...${NC}"
        docker-compose down
        echo -e "${GREEN}✅ Containers removed${NC}"
        ;;

    restart)
        echo -e "\n${YELLOW}🔄 Restarting Docker services...${NC}"
        docker-compose restart

        echo -e "\n${YELLOW}⏳ Waiting for services to be ready...${NC}"
        sleep 3

        echo -e "\n${YELLOW}📊 Service Status:${NC}"
        docker-compose ps

        echo -e "\n${GREEN}✅ Services restarted!${NC}"
        ;;

    logs)
        if [ -z "$2" ]; then
            echo -e "\n${YELLOW}📜 Showing logs for all services...${NC}"
            docker-compose logs -f
        else
            echo -e "\n${YELLOW}📜 Showing logs for $2...${NC}"
            docker-compose logs -f "$2"
        fi
        ;;

    status)
        echo -e "\n${YELLOW}📊 Service Status:${NC}"
        docker-compose ps

        echo -e "\n${YELLOW}🐘 PostgreSQL Connection:${NC}"
        if docker exec gatewayz-postgres pg_isready -U gatewayz > /dev/null 2>&1; then
            echo -e "${GREEN}✅ PostgreSQL is ready${NC}"
        else
            echo -e "${RED}❌ PostgreSQL is not ready${NC}"
        fi

        echo -e "\n${YELLOW}📮 Redis Connection:${NC}"
        if docker exec gatewayz-redis redis-cli ping > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Redis is ready${NC}"
        else
            echo -e "${RED}❌ Redis is not ready${NC}"
        fi
        ;;

    clean)
        echo -e "\n${RED}⚠️  Warning: This will remove all containers and volumes!${NC}"
        read -p "Are you sure? (yes/no): " -r
        if [[ $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo -e "\n${YELLOW}🗑️  Cleaning up Docker services and volumes...${NC}"
            docker-compose down -v
            echo -e "${GREEN}✅ Cleanup complete${NC}"
        else
            echo -e "${YELLOW}Cleanup cancelled${NC}"
        fi
        ;;

    init)
        echo -e "\n${YELLOW}🔧 Initializing database...${NC}"

        # Check if postgres is running
        if ! docker ps | grep -q gatewayz-postgres; then
            echo -e "${RED}❌ PostgreSQL container is not running${NC}"
            echo -e "${YELLOW}💡 Run: ./docker-start.sh start${NC}"
            exit 1
        fi

        # Re-run init script
        docker exec -i gatewayz-postgres psql -U gatewayz -d gatewayz_db < init_db.sql
        echo -e "${GREEN}✅ Database initialized${NC}"
        ;;

    psql)
        echo -e "\n${YELLOW}🐘 Connecting to PostgreSQL...${NC}"
        docker exec -it gatewayz-postgres psql -U gatewayz -d gatewayz_db
        ;;

    redis-cli)
        echo -e "\n${YELLOW}📮 Connecting to Redis...${NC}"
        docker exec -it gatewayz-redis redis-cli
        ;;

    *)
        echo -e "\n${YELLOW}Usage:${NC} $0 {command}"
        echo -e "\n${YELLOW}Commands:${NC}"
        echo -e "  ${GREEN}start${NC}        Start all services"
        echo -e "  ${GREEN}stop${NC}         Stop all services"
        echo -e "  ${GREEN}down${NC}         Stop and remove containers"
        echo -e "  ${GREEN}restart${NC}      Restart all services"
        echo -e "  ${GREEN}logs${NC} [svc]   Show logs (optionally for specific service)"
        echo -e "  ${GREEN}status${NC}       Show service status"
        echo -e "  ${GREEN}clean${NC}        Remove containers and volumes"
        echo -e "  ${GREEN}init${NC}         Re-initialize database"
        echo -e "  ${GREEN}psql${NC}         Connect to PostgreSQL CLI"
        echo -e "  ${GREEN}redis-cli${NC}    Connect to Redis CLI"
        echo -e "\n${YELLOW}Examples:${NC}"
        echo -e "  $0 start"
        echo -e "  $0 logs postgres"
        echo -e "  $0 psql"
        exit 1
        ;;
esac