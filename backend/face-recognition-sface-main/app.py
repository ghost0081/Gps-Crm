from fastapi import FastAPI, UploadFile, File, HTTPException
import cv2
import numpy as np
from sf_face_recognizer import FaceRecognizerSF
from yunet_face_detector import YuNetFaceDetector
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI(title="Face Recognition API")

def _jpeg_orientation(data: bytes) -> int:
    """Read the JPEG EXIF orientation tag. Phone cameras leave the pixels unrotated."""
    if len(data) < 4 or data[0:2] != b"\xff\xd8":
        return 1
    index = 2
    while index + 4 <= len(data):
        if data[index] != 0xFF:
            return 1
        marker = data[index + 1]
        if marker in (0xDA, 0xD9):
            return 1
        segment_length = int.from_bytes(data[index + 2:index + 4], "big")
        if segment_length < 2 or index + 2 + segment_length > len(data):
            return 1
        if marker == 0xE1:
            segment = data[index + 4:index + 2 + segment_length]
            if segment.startswith(b"Exif\x00\x00"):
                return _tiff_orientation(segment[6:])
        index += 2 + segment_length
    return 1


def _tiff_orientation(tiff: bytes) -> int:
    if len(tiff) < 8:
        return 1
    order = "little" if tiff[0:2] == b"II" else "big" if tiff[0:2] == b"MM" else None
    if order is None or int.from_bytes(tiff[2:4], order) != 42:
        return 1

    def read_u16(offset):
        return int.from_bytes(tiff[offset:offset + 2], order)

    def read_u32(offset):
        return int.from_bytes(tiff[offset:offset + 4], order)

    ifd = read_u32(4)
    if ifd + 2 > len(tiff):
        return 1
    count = read_u16(ifd)
    entry = ifd + 2
    for _ in range(count):
        if entry + 12 > len(tiff):
            return 1
        if read_u16(entry) == 0x0112:
            value = read_u16(entry + 8)
            return value if 1 <= value <= 8 else 1
        entry += 12
    return 1


def _apply_orientation(image, orientation):
    if orientation == 2:
        return cv2.flip(image, 1)
    if orientation == 3:
        return cv2.rotate(image, cv2.ROTATE_180)
    if orientation == 4:
        return cv2.flip(image, 0)
    if orientation == 5:
        return cv2.rotate(cv2.flip(image, 1), cv2.ROTATE_90_COUNTERCLOCKWISE)
    if orientation == 6:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)
    if orientation == 7:
        return cv2.rotate(cv2.flip(image, 1), cv2.ROTATE_90_CLOCKWISE)
    if orientation == 8:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)
    return image


def _limit_size(image, max_side=1280):
    height, width = image.shape[:2]
    longest = max(height, width)
    if longest <= max_side:
        return image
    scale = max_side / float(longest)
    return cv2.resize(image, (int(width * scale), int(height * scale)), interpolation=cv2.INTER_AREA)


def _prepare_image(data: bytes):
    array = np.frombuffer(data, np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None:
        return None
    image = _apply_orientation(image, _jpeg_orientation(data))
    return _limit_size(image)


def _extract_one_face(image):
    candidates = [
        image,
        cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE),
        cv2.rotate(image, cv2.ROTATE_180),
        cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE),
    ]
    last_features, last_faces = None, []
    for candidate in candidates:
        features, faces = face_recognizer.extract_features(candidate)
        last_features, last_faces = features, faces
        if faces is not None and len(faces) > 0:
            return features, faces
    return last_features, last_faces

# Initialize models globally
face_detector = YuNetFaceDetector("models/face_detection_yunet_2023mar.onnx")
face_recognizer = FaceRecognizerSF(
    weight_directory="models/face_recognizer_fast.onnx",
    face_detector=face_detector
)

@app.post("/extract-embedding")
async def extract_embedding(image: UploadFile = File(...)):
    contents = await image.read()
    img = _prepare_image(contents)

    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    features, faces = _extract_one_face(img)
    if faces is None or len(faces) == 0:
        return {"embedding": None, "message": "No face detected"}

    chosen = 0
    if len(faces) > 1:
        areas = [(index, float(face[2]) * float(face[3])) for index, face in enumerate(faces)]
        areas.sort(key=lambda item: item[1], reverse=True)
        if areas[0][1] < areas[1][1] * 2:
            return {"embedding": None, "message": "Multiple faces detected. Please ensure only one face is in the picture."}
        chosen = areas[0][0]

    embedding = features[chosen].flatten().tolist()
    
    return {"embedding": embedding, "message": "Face extracted successfully"}


class MatchRequest(BaseModel):
    embedding: List[float]
    known_embeddings: Dict[str, List[float]]

@app.post("/recognize")
async def recognize(request: MatchRequest):
    if not request.embedding:
        raise HTTPException(status_code=400, detail="No embedding provided")
    
    feature1 = np.array(request.embedding, dtype=np.float32).reshape(1, -1)
    
    max_score = 0.0
    sim_user_id = ""
    COSINE_THRESHOLD = 0.363 

    for user_id, emb_list in request.known_embeddings.items():
        feature2 = np.array(emb_list, dtype=np.float32).reshape(1, -1)
        score = face_recognizer.face_recognizer.match(feature1, feature2, cv2.FaceRecognizerSF_FR_COSINE)
        if score >= max_score:
            max_score = score
            sim_user_id = user_id

    if max_score < COSINE_THRESHOLD:
        return {"matched_id": None, "score": max_score, "message": "No match found"}
    
    return {"matched_id": sim_user_id, "score": max_score, "message": "Match found"}
