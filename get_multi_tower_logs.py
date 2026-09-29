import paramiko
import sys

# Force UTF-8 stdout for Windows terminal
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

def fetch_multi_tower_logs(count=25):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print(f"Connecting to VPS 200.141.9.19 to fetch the last {count} Multi-Tower Connection logs...\n")
    ssh.connect("200.141.9.19", username="root", password="Meets@081105", timeout=30)

    cmd = "docker logs --tail 1000 school-backend 2>&1"
    stdin, stdout, stderr = ssh.exec_command(cmd)
    raw_logs = stdout.read().decode('utf-8', errors='ignore')
    ssh.close()

    lines = raw_logs.splitlines()
    tower_logs = [line for line in lines if "MULTI-TOWER NETWORK" in line]

    print("==================================================")
    print(f"LAST {min(count, len(tower_logs))} MULTI-TOWER (CELL ID) CONNECTION LOGS")
    print("==================================================\n")

    if not tower_logs:
        print("[NO MULTI-TOWER LOGS DETECTED YET]")
        print("Note: Ensure the backend server was restarted so the new tracking code runs.")
    else:
        for line in tower_logs[-count:]:
            safe_line = line.encode('ascii', errors='replace').decode('ascii')
            # Extract exactly the log string after the Docker timestamp
            if "MULTI-TOWER NETWORK" in safe_line:
                clean_msg = safe_line[safe_line.find("[MULTI-TOWER NETWORK]"):]
                print("🗼", clean_msg)
            else:
                print("🗼", safe_line)

if __name__ == "__main__":
    count_arg = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    fetch_multi_tower_logs(count_arg)
