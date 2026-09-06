import paramiko
import os
import zipfile
import time

def create_zip(local_dir, zip_path):
    print(f"Creating zip file {zip_path}...")
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(local_dir):
            dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'build', '.expo', 'android', 'ios', 'windows', 'macos', 'linux']]
            for file in files:
                full_path = os.path.join(root, file)
                rel_path = os.path.relpath(full_path, local_dir)
                zipf.write(full_path, rel_path)
    print(f"Zip created! Size: {os.path.getsize(zip_path) / (1024*1024):.2f} MB")

def deploy():
    local_backend = r"D:\coding\crm-school\Gps-Crm\backend"
    zip_backend_path = r"D:\coding\crm-school\Gps-Crm\backend_deploy.zip"
    
    local_frontend = r"D:\coding\crm-school\Gps-Crm\frontend"
    zip_frontend_path = r"D:\coding\crm-school\Gps-Crm\frontend_deploy.zip"
    
    create_zip(local_backend, zip_backend_path)
    create_zip(local_frontend, zip_frontend_path)
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("Connecting to root@200.141.9.19...")
    ssh.connect('200.141.9.19', username='root', password='Meets@081105', timeout=30)
    print("Connected successfully!")

    def run_cmd(cmd):
        print(f"[REMOTE CMD] {cmd}")
        stdin, stdout, stderr = ssh.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='ignore')
        err = stderr.read().decode('utf-8', errors='ignore')
        if out:
            print(out.strip())
        if err and "warning" not in err.lower():
            print("ERR:", err.strip())

    print("\n=== UPLOADING CODE TO VPS ===")
    sftp = ssh.open_sftp()
    sftp.put(zip_backend_path, "/root/backend_deploy.zip")
    sftp.put(zip_frontend_path, "/root/frontend_deploy.zip")
    sftp.close()

    print("\n=== EXTRACTING BACKEND CODE ===")
    run_cmd("mkdir -p /root/school-backend")
    run_cmd("unzip -o /root/backend_deploy.zip -d /root/school-backend")
    run_cmd("rm -f /root/backend_deploy.zip")

    print("\n=== EXTRACTING FRONTEND CODE ===")
    run_cmd("mkdir -p /root/school-frontend")
    run_cmd("unzip -o /root/frontend_deploy.zip -d /root/school-frontend")
    run_cmd("rm -f /root/frontend_deploy.zip")

    print("\n=== BUILDING & RESTARTING CONTAINERS/PM2 ===")
    # Backend has docker-compose or PM2. If docker-compose exists, use it.
    run_cmd("cd /root/school-backend && if [ -f docker-compose.yml ]; then docker compose up -d --build || docker-compose up -d --build; else npm install --production && pm2 restart school-backend || pm2 start index.js --name school-backend; fi")
    
    # Frontend usually npm start or pm2
    run_cmd("cd /root/school-frontend && if [ -f docker-compose.yml ]; then docker compose up -d --build || docker-compose up -d --build; else npm install --production && npm run build && pm2 restart school-frontend || pm2 start npm --name school-frontend -- start; fi")

    ssh.close()
    
    if os.path.exists(zip_backend_path):
        os.remove(zip_backend_path)
    if os.path.exists(zip_frontend_path):
        os.remove(zip_frontend_path)
        
    print("\n=== DEPLOYMENT COMPLETE! ===")

if __name__ == '__main__':
    deploy()
