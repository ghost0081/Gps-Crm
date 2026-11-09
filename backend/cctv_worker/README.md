# SchoolMS CCTV & IP Camera Recognition Worker

This worker connects to RTSP streams from CCTV / IP / NVR cameras, samples frames at 1–2 FPS, performs real-time multi-face detection (YuNet), tracks faces across frames (IOU Tracker), and executes high-speed vector dot-product matching (SFace) against an in-memory cache of enrolled students for the school.

## Running Locally / On School Edge Mini-PC:
```bash
pip install -r requirements.txt
python cctv_recognition_worker.py --school_id <SCHOOL_ID> --backend_url http://localhost:5000
```

## Running with a Direct RTSP Stream or USB Webcam:
```bash
# Using Webcam (Index 0) with visual monitor GUI:
python cctv_recognition_worker.py --school_id <SCHOOL_ID> --rtsp_url 0 --gui

# Using an IP Camera RTSP URL:
python cctv_recognition_worker.py --school_id <SCHOOL_ID> --rtsp_url "rtsp://admin:pass@192.168.1.50:554/live" --direction IN
```

## Architecture:
1. **In-Memory Cache**: Syncs student face embeddings once per minute and flattens them into a normalized matrix for sub-millisecond matching.
2. **IOU Track IDs**: Tracks individuals moving in front of the camera so attendance is logged only **once per visit**, ignoring continuous lingering.
3. **Anti-Passback Suppression**: Dispatches to `/api/attendance/gate-recognition` which suppresses duplicate entries within a 10-minute window and notifies parents automatically.
