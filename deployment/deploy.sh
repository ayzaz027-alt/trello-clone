#!/bin/bash

# Trello Clone Deployment Script for AWS EC2
# Usage: ./deploy.sh

set -e

echo "╔════════════════════════════════════════════╗"
echo "║  🚀 Trello Clone Deployment Script 🚀    ║"
echo "╚════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root (use sudo)"
    exit 1
fi

print_info "Step 1: Updating system packages..."
apt update && apt upgrade -y
print_success "System packages updated"

print_info "Step 2: Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
print_success "Node.js $(node -v) installed"

print_info "Step 3: Installing PostgreSQL..."
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql
print_success "PostgreSQL installed"

print_info "Step 4: Installing Redis..."
apt install -y redis-server
systemctl start redis-server
systemctl enable redis-server
print_success "Redis installed"

print_info "Step 5: Installing Nginx..."
apt install -y nginx
systemctl start nginx
systemctl enable nginx
print_success "Nginx installed"

print_info "Step 6: Installing PM2..."
npm install -g pm2
print_success "PM2 installed"

print_info "Step 7: Setting up database..."
sudo -u postgres psql << EOF
CREATE DATABASE trello_clone;
CREATE USER trello_user WITH PASSWORD 'SecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE trello_clone TO trello_user;
EOF
print_success "Database created"

print_info "Step 8: Installing dependencies..."
cd backend && npm install --production
cd ../frontend && npm install && npm run build
cd ..
print_success "Dependencies installed"

print_info "Step 9: Configuring Nginx..."
cp nginx/trello-clone.conf /etc/nginx/sites-available/trello-clone
ln -sf /etc/nginx/sites-available/trello-clone /etc/nginx/sites-enabled/
SERVER_IP=$(curl -s ifconfig.me)
sed -i "s/YOUR_SERVER_IP_OR_DOMAIN/$SERVER_IP/g" /etc/nginx/sites-available/trello-clone
nginx -t && systemctl reload nginx
print_success "Nginx configured"

print_info "Step 10: Starting apps..."
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 startup
print_success "Apps started"

echo ""
echo "✅ Deployment Complete!"
echo "🌐 Access: http://$SERVER_IP"
echo ""
