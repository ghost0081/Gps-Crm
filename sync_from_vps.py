import os
import sys
import tarfile
import paramiko
import time

sys.stdout.reconfigure(encoding='utf-8')

VPS_IP = "200.141.9.19"
VPS_USER = "root"
VPS_PASS = "Meets@081105"

BASE_DIR = r"D:\coding\crm-school\Gps-Crm"
LOCAL_BACKEND_TAR = os.path.join(BASE_DIR, "school-backend-sync.tar.gz")
LOCAL_FRONTEND_TAR = os.path.join(BASE_DIR, "school-frontend-sync.tar.gz")

LOCAL_BACKEND_DIR = os.path.join(BASE_DIR, "backend")
LOCAL_FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")

def run_ssh_command(ssh, cmd):
    print(f"[REMOTE] {cmd}")
    stdin, stdout, stderr = ssh.exec_command(cmd)
    out = stdout.read().decode('utf-8', errors='ignore')
    err = stderr.read().decode('utf-8', errors='ignore')
    if out.strip():
        print(f"  {out.strip()[:500]}")
    if err.strip():
        print(f"  ERR: {err.strip()[:500]}")
    return out

def sftp_progress_callback(transferred, total):
    percent = (transferred / total) * 100 if total > 0 else 0
    sys.stdout.write(f"\r  Transferred: {transferred / (1024*1024):.2f} MB / {total / (1024*1024):.2f} MB ({percent:.1f}%)")
    sys.stdout.flush()

def main():
    print("==================================================")
    print("SYNCING LIVE CODEBASE FROM VPS TO LOCAL MACHINE")
    print("==================================================")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to {VPS_USER}@{VPS_IP}...")
    ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=30)
    print("Connected successfully!\n")

    # Step 1: Create archives on the server
    print("--- Step 1: Archiving Live Backend on Server ---")
    run_ssh_command(ssh, "cd /root/school-backend && tar --exclude='node_modules' --exclude='*.log' -czf /root/school-backend-sync.tar.gz .")
    
    print("\n--- Step 2: Archiving Live Frontend on Server ---")
    run_ssh_command(ssh, "cd /root/school-frontend && tar --exclude='node_modules' --exclude='*.log' -czf /root/school-frontend-sync.tar.gz .")

    # Step 3: Check archive sizes
    print("\n--- Step 3: Checking Archive Sizes ---")
    run_ssh_command(ssh, "ls -lh /root/school-backend-sync.tar.gz /root/school-frontend-sync.tar.gz")

    # Step 4: Download via SFTP
    print("\n--- Step 4: Downloading Archives via SFTP ---")
    sftp = ssh.open_sftp()

    print("\nDownloading Backend Archive...")
    sftp.get("/root/school-backend-sync.tar.gz", LOCAL_BACKEND_TAR, callback=sftp_progress_callback)
    print("\nBackend download complete!")

    print("\nDownloading Frontend Archive...")
    sftp.get("/root/school-frontend-sync.tar.gz", LOCAL_FRONTEND_TAR, callback=sftp_progress_callback)
    print("\nFrontend download complete!")

    # Step 5: Clean up on VPS
    print("\n--- Step 5: Cleaning up Server Archives ---")
    run_ssh_command(ssh, "rm -f /root/school-backend-sync.tar.gz /root/school-frontend-sync.tar.gz")
    sftp.close()
    ssh.close()
    print("Server connection closed.")

    # Step 6: Extract locally
    print("\n--- Step 6: Extracting Code Locally ---")
    
    print(f"Extracting Backend to: {LOCAL_BACKEND_DIR}")
    os.makedirs(LOCAL_BACKEND_DIR, exist_ok=True)
    with tarfile.open(LOCAL_BACKEND_TAR, "r:gz") as tar:
        tar.extractall(LOCAL_BACKEND_DIR)
    print("Backend extraction complete!")

    print(f"Extracting Frontend to: {LOCAL_FRONTEND_DIR}")
    os.makedirs(LOCAL_FRONTEND_DIR, exist_ok=True)
    with tarfile.open(LOCAL_FRONTEND_TAR, "r:gz") as tar:
        tar.extractall(LOCAL_FRONTEND_DIR)
    print("Frontend extraction complete!")

    # Step 7: Clean up local tar files
    if os.path.exists(LOCAL_BACKEND_TAR):
        os.remove(LOCAL_BACKEND_TAR)
    if os.path.exists(LOCAL_FRONTEND_TAR):
        os.remove(LOCAL_FRONTEND_TAR)

    print("\n==================================================")
    print("[SUCCESS] BACKEND & FRONTEND SYNCED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    main()
