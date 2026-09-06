from fastapi import FastAPI, UploadFile, File, HTTPException
import cv2
import numpy as np
from sf_face_recognizer import FaceRecognizerSF
from yunet_face_detector import YuNetFaceDetector
from pydantic import BaseModel
from typing import List, Dict

app = FastAPI(title="Face Recognition API")

# Initialize models globally
face_detector = YuNetFaceDetector("models/face_detection_yunet_2023mar.onnx")
face_recognizer = FaceRecognizerSF(
    weight_directory="models/face_recognizer_fast.onnx",
    face_detector=face_detector
)

@app.post("/extract-embedding")
async def extract_embedding(image: UploadFile = File(...)):
    contents = await image.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise HTTPException(status_code=400, detail="Invalid image file")

    features, faces = face_recognizer.extract_features(img)
    if faces is None or len(faces) == 0:
        return {"embedding": None, "message": "No face detected"}
    
    if len(faces) > 1:
        return {"embedding": None, "message": "Multiple faces detected. Please ensure only one face is in the picture."}

    # feature is a numpy array. convert to float list.
    embedding = features[0].flatten().tolist()
    
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
