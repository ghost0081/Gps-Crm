import paramiko
import sys
import socket
import threading
import time

# Ensure UTF-8 output encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_IP = "200.141.9.19"
VPS_USER = "root"
VPS_PASS = "Meets@081105"
TRACKER_PORT = 5023



def send_mock_tracker_data():
    """Continuously sends a 5-tower packet to the VPS tracker port every 5 seconds."""
    from datetime import datetime
    print(f"[*] Starting background Mock Tracker. Sending 5-Tower packets to {VPS_IP}:{TRACKER_PORT} every 5 seconds...")
    while True:
        try:
            # Generate current UTC date/time in ddmmyy and hhmmss formats
            now = datetime.utcnow()
            date_str = now.strftime("%d%m%y")
            time_str = now.strftime("%H%M%S")
            
            # Note: We set Lat/Lon to 0.0, 0.0 to force the server to fallback to LBS Multi-Tower calculation!
            mock_packet = f"$M,864163085121037,2.04,L,M,1,{date_str},{time_str},00.000000,N,000.000000,E,0.0,0.00,00000.0,0.00,0.00,404,11,CE0C,6E5A70D,22,CE0C,70CB735,1,CE0C,70CB734,3,CE0C,6E5A717,13,CE0C,6E5A716,9,0,0.0,3.3,0,xxxx,00099*99\r\n"

            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(3)
            s.connect((VPS_IP, TRACKER_PORT))
            s.sendall(mock_packet.encode('utf-8'))
            s.close()
        except Exception as e:
            pass # Silently fail the mock sender if connection drops, log stream will show real errors
        time.sleep(5)

def stream_server_logs():
    """Streams the live Docker logs from the server."""
    print(f"[*] Connecting to VPS {VPS_IP} via SSH to stream live logs...\n")
    
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        ssh.connect(VPS_IP, username=VPS_USER, password=VPS_PASS, timeout=15)
        print("==================================================")
        print("[SUCCESS] CONNECTED TO SERVER LOGS! (Press Ctrl+C to stop)")
        print("==================================================\n")
        
        # Tail the last 10 lines and then follow live
        stdin, stdout, stderr = ssh.exec_command("docker logs -f --tail 10 school-backend 2>&1")
        
        for line in iter(stdout.readline, ""):
            if not line:
                break
            
            safe_line = line.strip().encode('ascii', errors='replace').decode('ascii')
            
            # Highlight positioning logs
            if "MULTI-TOWER" in safe_line:
                print("🗼 [MULTI-TOWER DETECTED]", safe_line.split("MULTI-TOWER NETWORK]")[-1])
            elif "LBS FIX" in safe_line:
                print("🎯 [LBS RESOLVED]", safe_line.split("LBS FIX]")[-1])
            elif "GPS FIX" in safe_line:
                print("🛰️ [GPS RESOLVED]", safe_line.split("GPS FIX]")[-1])
            elif "ASCII PROTOCOL" in safe_line:
                print("📡 [INCOMING DATA]", safe_line.split("ASCII PROTOCOL]")[-1])
            else:
                # Print generic server logs subtly
                print("   ", safe_line)
                
    except KeyboardInterrupt:
        print("\n\n[STOPPED] Stopped testing and log streaming.")
    except Exception as e:
        print(f"\n[ERROR] Connection Error: {e}")
    finally:
        ssh.close()
        # Force exit to kill the background thread
        import os
        os._exit(0)

if __name__ == "__main__":
    # Start the mock tracker in a background thread
    sender_thread = threading.Thread(target=send_mock_tracker_data, daemon=True)
    sender_thread.start()
    
    # Start streaming the logs in the main thread
    stream_server_logs()
