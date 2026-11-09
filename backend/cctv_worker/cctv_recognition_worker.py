#!/usr/bin/env python3
"""
SchoolMS AI Face Recognition - Live CCTV / RTSP Stream Ingestion Worker
========================================================================
Performs real-time multi-camera RTSP ingestion, multi-face detection (YuNet),
temporary track-ID tracking (to recognize each person once), and high-speed
vector dot-product cosine matching (SFace) against an in-memory school embedding matrix.
"""

import os
import sys
import time
import math
import argparse
import threading
import logging
from typing import Dict, List, Tuple, Optional
import numpy as np
import requests
import cv2

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] [%(threadName)s] %(message)s'
)
logger = logging.getLogger("CCTVWorker")

DEFAULT_COSINE_THRESHOLD = 0.363
IOU_TRACK_THRESHOLD = 0.30
TRACK_EXPIRY_SECONDS = 4.0

class FaceTrack:
    def __init__(self, track_id: int, bbox: Tuple[int, int, int, int], face_raw: np.ndarray):
        self.track_id = track_id
        self.bbox = bbox # (x, y, w, h)
        self.face_raw = face_raw
        self.last_seen = time.time()
        self.recognized = False
        self.matched_student_id = None
        self.matched_name = None
        self.match_score = 0.0

def calculate_iou(boxA: Tuple[int, int, int, int], boxB: Tuple[int, int, int, int]) -> float:
    xA = max(boxA[0], boxB[0])
    yA = max(boxA[1], boxB[1])
    xB = min(boxA[0] + boxA[2], boxB[0] + boxB[2])
    yB = min(boxA[1] + boxA[3], boxB[1] + boxB[3])

    interArea = max(0, xB - xA) * max(0, yB - yA)
    boxAArea = boxA[2] * boxA[3]
    boxBArea = boxB[2] * boxB[3]

    unionArea = float(boxAArea + boxBArea - interArea)
    if unionArea <= 0:
        return 0.0
    return interArea / unionArea


class SchoolEmbeddingCache:
    """Maintains an in-memory normalized NumPy matrix for all enrolled students in the school."""
    def __init__(self, backend_url: str, school_id: str):
        self.backend_url = backend_url.rstrip('/')
        self.school_id = school_id
        self.lock = threading.Lock()
        self.matrix: Optional[np.ndarray] = None # Shape: (K, 128)
        self.vector_map: List[Dict] = [] # Index -> { student_id, name, rollNum, className }
        self.last_sync = 0.0

    def refresh(self) -> int:
        url = f"{self.backend_url}/api/attendance/registered-faces/{self.school_id}"
        try:
            logger.info(f"Syncing student face embeddings from: {url}")
            res = requests.get(url, timeout=10)
            if not res.ok:
                logger.error(f"Failed to fetch registered faces: {res.status_code} - {res.text}")
                return 0

            data = res.json()
            new_vectors = []
            new_map = []

            for student in data:
                s_id = student.get('_id')
                name = student.get('name', 'Unknown')
                roll = student.get('rollNum', '')
                cls_name = student.get('className', '')
                embeddings = student.get('embeddings', [])

                for emb in embeddings:
                    if len(emb) == 128:
                        vec = np.array(emb, dtype=np.float32)
                        # L2-normalize vector
                        norm = np.linalg.norm(vec)
                        if norm > 0:
                            vec = vec / norm
                        new_vectors.append(vec)
                        new_map.append({
                            'student_id': s_id,
                            'name': name,
                            'rollNum': roll,
                            'className': cls_name
                        })

            with self.lock:
                if len(new_vectors) > 0:
                    self.matrix = np.vstack(new_vectors) # Shape: (K, 128)
                    self.vector_map = new_map
                    self.last_sync = time.time()
                    count = len(self.vector_map)
                    logger.info(f"Loaded {count} face embedding vectors for school {self.school_id}")
                    return count
                else:
                    self.matrix = None
                    self.vector_map = []
                    logger.warning("No registered face embeddings found for this school.")
                    return 0
        except Exception as e:
            logger.error(f"Error syncing embeddings: {e}")
            return 0

    def match(self, feature: np.ndarray, threshold: float = DEFAULT_COSINE_THRESHOLD) -> Tuple[bool, Optional[Dict], float]:
        with self.lock:
            if self.matrix is None or len(self.vector_map) == 0:
                return False, None, 0.0

            # Ensure probe vector is normalized
            vec = feature.flatten().astype(np.float32)
            norm = np.linalg.norm(vec)
            if norm > 0:
                vec = vec / norm

            # Fast matrix dot product: shape (K,)
            scores = np.dot(self.matrix, vec)
            best_idx = int(np.argmax(scores))
            best_score = float(scores[best_idx])

            if best_score >= threshold:
                matched_info = self.vector_map[best_idx]
                return True, matched_info, best_score

            return False, None, best_score


class CameraStreamProcessor:
    """Handles RTSP capture, YuNet face detection, tracking, and attendance dispatch for a camera."""
    def __init__(self,
                 camera_id: str,
                 camera_name: str,
                 rtsp_source: str,
                 direction: str,
                 backend_url: str,
                 school_id: str,
                 cache: SchoolEmbeddingCache,
                 yunet_model_path: str,
                 sface_model_path: str,
                 target_fps: int = 2,
                 show_gui: bool = False):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.rtsp_source = rtsp_source
        self.direction = direction
        self.backend_url = backend_url.rstrip('/')
        self.school_id = school_id
        self.cache = cache
        self.yunet_model_path = yunet_model_path
        self.sface_model_path = sface_model_path
        self.target_fps = target_fps
        self.show_gui = show_gui
        self.running = False
        self.thread: Optional[threading.Thread] = None

        # Face Detector & Recognizer
        self.detector = cv2.FaceDetectorYN.create(yunet_model_path, "", (320, 320))
        self.detector.setScoreThreshold(0.65)
        self.recognizer = cv2.FaceRecognizerSF.create(sface_model_path, "")

        # Active tracks: { track_id: FaceTrack }
        self.tracks: Dict[int, FaceTrack] = {}
        self.next_track_id = 1

    def start(self):
        self.running = True
        self.thread = threading.Thread(target=self._run_loop, name=f"Cam-{self.camera_name}")
        self.thread.daemon = True
        self.thread.start()

    def stop(self):
        self.running = False
        if self.thread and self.thread.is_alive():
            self.thread.join(timeout=3)

    def _update_tracks(self, faces: np.ndarray) -> List[FaceTrack]:
        current_time = time.time()
        updated_tracks = []

        if faces is None or len(faces) == 0:
            # Purge expired tracks
            expired = [tid for tid, trk in self.tracks.items() if current_time - trk.last_seen > TRACK_EXPIRY_SECONDS]
            for tid in expired:
                del self.tracks[tid]
            return []

        detected_boxes = []
        for face in faces:
            x, y, w, h = int(face[0]), int(face[1]), int(face[2]), int(face[3])
            detected_boxes.append((x, y, w, h, face))

        matched_track_ids = set()
        matched_box_indices = set()

        # Match detected boxes with existing active tracks
        for b_idx, (x, y, w, h, raw_face) in enumerate(detected_boxes):
            box = (x, y, w, h)
            best_iou = 0.0
            best_tid = None

            for tid, track in self.tracks.items():
                if tid in matched_track_ids:
                    continue
                iou = calculate_iou(box, track.bbox)
                if iou > best_iou:
                    best_iou = iou
                    best_tid = tid

            if best_iou >= IOU_TRACK_THRESHOLD and best_tid is not None:
                track = self.tracks[best_tid]
                track.bbox = box
                track.face_raw = raw_face
                track.last_seen = current_time
                matched_track_ids.add(best_tid)
                matched_box_indices.add(b_idx)
                updated_tracks.append(track)

        # Create new tracks for unmatched boxes
        for b_idx, (x, y, w, h, raw_face) in enumerate(detected_boxes):
            if b_idx not in matched_box_indices:
                tid = self.next_track_id
                self.next_track_id += 1
                new_track = FaceTrack(tid, (x, y, w, h), raw_face)
                self.tracks[tid] = new_track
                updated_tracks.append(new_track)

        # Purge stale tracks
        expired = [tid for tid, trk in self.tracks.items() if current_time - trk.last_seen > TRACK_EXPIRY_SECONDS]
        for tid in expired:
            del self.tracks[tid]

        return updated_tracks

    def _dispatch_attendance(self, track: FaceTrack):
        payload = {
            "schoolId": self.school_id,
            "cameraId": self.camera_id if self.camera_id else None,
            "studentId": track.matched_student_id,
            "confidence": float(track.match_score),
            "direction": self.direction,
        }
        url = f"{self.backend_url}/api/attendance/gate-recognition"
        try:
            res = requests.post(url, json=payload, timeout=5)
            if res.ok:
                resp_json = res.json()
                if resp_json.get('duplicate'):
                    logger.info(f"[{self.camera_name}] Duplicate suppressed: {track.matched_name}")
                else:
                    logger.info(f"[{self.camera_name}] ATTENDANCE RECORDED: {track.matched_name} ({self.direction}) - Score: {track.match_score:.2f}")
            else:
                logger.warning(f"Failed to record attendance: {res.status_code} {res.text}")
        except Exception as e:
            logger.error(f"Error posting attendance event: {e}")

    def _run_loop(self):
        logger.info(f"Starting camera loop for {self.camera_name} (Source: {self.rtsp_source})")
        
        # Source can be int (webcam 0) or RTSP URL
        source = int(self.rtsp_source) if str(self.rtsp_source).isdigit() else self.rtsp_source

        cap = cv2.VideoCapture(source)
        if not cap.isOpened():
            logger.error(f"Could not open camera stream: {self.rtsp_source}")
            return

        frame_interval = 1.0 / max(1, self.target_fps)
        last_process_time = 0.0

        while self.running:
            ret, frame = cap.read()
            if not ret:
                logger.warning(f"[{self.camera_name}] Frame dropped or stream disconnected. Reconnecting in 3s...")
                time.sleep(3)
                cap.release()
                cap = cv2.VideoCapture(source)
                continue

            current_time = time.time()
            if current_time - last_process_time < frame_interval:
                if self.show_gui:
                    cv2.imshow(f"SchoolMS: {self.camera_name}", frame)
                    if cv2.waitKey(1) & 0xFF == ord('q'):
                        break
                continue

            last_process_time = current_time
            h, w = frame.shape[:2]
            self.detector.setInputSize((w, h))

            # Multi-Face Detection
            _, faces = self.detector.detect(frame)
            active_tracks = self._update_tracks(faces)

            # Process unrecognized tracks
            for track in active_tracks:
                if not track.recognized:
                    # Minimum face size filter (e.g. at least 40x40 pixels)
                    if track.bbox[2] >= 40 and track.bbox[3] >= 40:
                        aligned_face = self.recognizer.alignCrop(frame, track.face_raw)
                        feat = self.recognizer.feature(aligned_face)

                        matched, student_info, score = self.cache.match(feat)
                        track.recognized = True
                        track.match_score = score

                        if matched and student_info:
                            track.matched_student_id = student_info['student_id']
                            track.matched_name = student_info['name']
                            self._dispatch_attendance(track)
                        else:
                            track.matched_name = "Unknown"
                            logger.info(f"[{self.camera_name}] Unknown face detected (Score: {score:.2f})")

            # Optional visual rendering for monitoring / debugging
            if self.show_gui:
                for track in self.tracks.values():
                    x, y, bw, bh = track.bbox
                    color = (0, 255, 0) if (track.matched_student_id is not None) else (0, 0, 255)
                    cv2.rectangle(frame, (x, y), (x + bw, y + bh), color, 2)
                    label = f"{track.matched_name or 'Scanning...'} ({track.match_score:.2f})"
                    cv2.putText(frame, label, (x, max(20, y - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)

                cv2.imshow(f"SchoolMS: {self.camera_name}", frame)
                if cv2.waitKey(1) & 0xFF == ord('q'):
                    break

        cap.release()
        if self.show_gui:
            cv2.destroyAllWindows()
        logger.info(f"Stopped camera processor for {self.camera_name}")


def main():
    parser = argparse.ArgumentParser(description="SchoolMS Live CCTV Face Recognition Worker")
    parser.add_argument("--school_id", required=True, help="School ID (admin MongoDB _id)")
    parser.add_argument("--backend_url", default="http://localhost:5000", help="SchoolMS Backend URL")
    parser.add_argument("--yunet_model", default="models/face_detection_yunet_2023mar.onnx", help="Path to YuNet ONNX model")
    parser.add_argument("--sface_model", default="models/face_recognizer_fast.onnx", help="Path to SFace ONNX model")
    parser.add_argument("--rtsp_url", default=None, help="Direct RTSP stream URL or webcam index (e.g. 0)")
    parser.add_argument("--camera_name", default="Main Entrance Camera", help="Name of camera")
    parser.add_argument("--direction", default="IN", choices=["IN", "OUT", "GENERAL"], help="Attendance direction")
    parser.add_argument("--fps", type=int, default=2, help="Frame sampling rate (FPS)")
    parser.add_argument("--gui", action="store_true", help="Display visual window with face bounding boxes")

    args = parser.parse_args()

    # Find models relative to script if default not found
    script_dir = os.path.dirname(os.path.abspath(__file__))
    models_fallback_dir = os.path.join(script_dir, "..", "face-recognition-sface-main", "models")
    
    yunet_path = args.yunet_model
    if not os.path.exists(yunet_path):
        yunet_path = os.path.join(models_fallback_dir, "face_detection_yunet_2023mar.onnx")
        
    sface_path = args.sface_model
    if not os.path.exists(sface_path):
        sface_path = os.path.join(models_fallback_dir, "face_recognizer_fast.onnx")

    logger.info(f"YuNet Model Path: {yunet_path} (Exists: {os.path.exists(yunet_path)})")
    logger.info(f"SFace Model Path: {sface_path} (Exists: {os.path.exists(sface_path)})")

    if not os.path.exists(yunet_path) or not os.path.exists(sface_path):
        logger.error("Required ONNX model files not found! Please check model paths.")
        sys.exit(1)

    # Initialize Embedding Cache
    cache = SchoolEmbeddingCache(args.backend_url, args.school_id)
    cache.refresh()

    # If a direct RTSP / webcam source is given, run single camera processor
    if args.rtsp_url:
        processor = CameraStreamProcessor(
            camera_id="manual",
            camera_name=args.camera_name,
            rtsp_source=args.rtsp_url,
            direction=args.direction,
            backend_url=args.backend_url,
            school_id=args.school_id,
            cache=cache,
            yunet_model_path=yunet_path,
            sface_model_path=sface_path,
            target_fps=args.fps,
            show_gui=args.gui
        )
        processor.start()
        try:
            while True:
                time.sleep(60)
                # Periodic cache refresh every 60 seconds to pick up new student registrations
                cache.refresh()
        except KeyboardInterrupt:
            logger.info("Terminating worker...")
            processor.stop()
    else:
        # Multi-camera mode: Query enabled cameras from backend
        cameras_url = f"{args.backend_url.rstrip('/')}/api/cameras/school/{args.school_id}"
        logger.info(f"Fetching registered cameras from {cameras_url}...")
        try:
            res = requests.get(cameras_url, timeout=10)
            if not res.ok:
                logger.error(f"Failed to fetch cameras: {res.status_code}")
                sys.exit(1)
            cameras = res.json()
            active_cameras = [c for c in cameras if c.get('enabled', True)]
            if not active_cameras:
                logger.warning("No enabled cameras found in database for this school. Use --rtsp_url to specify manually.")
                sys.exit(0)

            processors = []
            for cam in active_cameras:
                p = CameraStreamProcessor(
                    camera_id=cam.get('_id'),
                    camera_name=cam.get('name', 'Gate Cam'),
                    rtsp_source=cam.get('rtspUrl'),
                    direction=cam.get('direction', 'IN'),
                    backend_url=args.backend_url,
                    school_id=args.school_id,
                    cache=cache,
                    yunet_model_path=yunet_path,
                    sface_model_path=sface_path,
                    target_fps=cam.get('fps', 2),
                    show_gui=args.gui
                )
                p.start()
                processors.append(p)

            logger.info(f"Started {len(processors)} camera stream processors.")
            while True:
                time.sleep(60)
                cache.refresh()
        except KeyboardInterrupt:
            logger.info("Stopping all camera processors...")
            for p in processors:
                p.stop()


if __name__ == '__main__':
    main()
