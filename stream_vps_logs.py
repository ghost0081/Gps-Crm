import time
import sys
import paramiko

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

VPS_IP = "200.141.9.19"
VPS_USER = "root"
VPS_PASS = "Meets@081105"

def stream_logs():
    print("==================================================")
    print(f"CONNECTING TO GT06 BACKEND SERVER AT {VPS_IP}...")
    print("==================================================\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("[SUCCESS] CONNECTED TO VPS SERVER!")
        print("[STREAMING] LIVE GT06 & BLE TELEMETRY LOGS (Press Ctrl+C to stop)...\n")

        # Stream docker logs in real-time using tail -f
        stdin, stdout, stderr = ssh.exec_command("docker logs -f --tail 50 school-backend")

        for line in iter(stdout.readline, ""):
            if not line:
                break
            line_clean = line.strip()

            if "SATELLITE GPS FIX" in line_clean:
                print(f"[SATELLITE GPS]   {line_clean}")
            elif "CELL TOWER LBS FIX" in line_clean:
                print(f"[CELL TOWER LBS]  {line_clean}")
            elif "Heartbeat" in line_clean:
                print(f"[BATTERY/HEARTBEAT] {line_clean}")
            elif "Logged In" in line_clean:
                print(f"[DEVICE LOGIN]    {line_clean}")
            elif "BLE TELEMETRY" in line_clean:
                print(f"[BLE TELEMETRY]   {line_clean}")
            elif "Error" in line_clean or "ERR" in line_clean:
                print(f"[ERROR]           {line_clean}")
            else:
                print(f"                  {line_clean}")

    except KeyboardInterrupt:
        print("\n\n[STOPPED] Stopped streaming logs.")
    except Exception as e:
        print(f"\n[ERROR] Connection Error: {e}")
    finally:
        ssh.close()

if __name__ == "__main__":
    stream_logs()
