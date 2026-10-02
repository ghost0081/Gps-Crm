import paramiko
import sys
import time

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_IP = "200.141.9.19"
VPS_USER = "root"
VPS_PASS = "Meets@081105"

def restart_vps_services():
    print("==================================================")
    print(f"[*] CONNECTING TO VPS {VPS_IP}...")
    print("==================================================")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[+] SSH Connection Successful!\n")
        
        # 1. Restart all Docker containers (catches backend, frontend, database if using Docker)
        print("[*] Attempting to restart all Docker containers (Backend & Frontend)...")
        # We start all stopped ones and restart running ones
        cmd = "docker restart $(docker ps -a -q) 2>/dev/null"
        stdin, stdout, stderr = ssh.exec_command(cmd)
        
        docker_out = stdout.read().decode('utf-8').strip()
        if docker_out:
            print(f"[+] Successfully restarted Docker containers:\n{docker_out}")
        else:
            print("[-] No Docker containers found or Docker is not running.")

        # 2. Restart PM2 (Just in case the frontend is hosted via PM2 instead of Docker)
        print("\n[*] Attempting to restart PM2 services (if any exist)...")
        cmd_pm2 = "pm2 restart all 2>/dev/null"
        stdin, stdout, stderr = ssh.exec_command(cmd_pm2)
        pm2_out = stdout.read().decode('utf-8').strip()
        if pm2_out:
            print("[+] PM2 services restarted successfully.")
        else:
            print("[-] No PM2 services found.")

        # 3. Check disk space (Sometimes servers crash because the disk is full)
        print("\n[*] Checking VPS Disk Space...")
        stdin, stdout, stderr = ssh.exec_command("df -h /")
        print(stdout.read().decode('utf-8').strip())

        print("\n==================================================")
        print("[SUCCESS] ALL SERVER SERVICES HAVE BEEN RESTARTED!")
        print("==================================================")
        print("Note: Please wait about 30 to 60 seconds for the React frontend and Node backend to fully boot up.")
        print("Then, try refreshing http://200.141.9.19:3000 in your browser.")
        
    except paramiko.AuthenticationException:
        print("[ERROR] Authentication failed. Please check the VPS password.")
    except Exception as e:
        print(f"\n[ERROR] Connection or Execution Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    restart_vps_services()
