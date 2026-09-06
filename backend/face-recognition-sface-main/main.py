import numpy as np
import cv2 as cv
import os

weights_path = "face_detection_yunet_2023mar.onnx"
score_threshold = 0.65
face_detector = cv.FaceDetectorYN_create(weights_path, "", (0, 0))
face_detector.setScoreThreshold(score_threshold)

modelPath = "face_recognizer_fast.onnx"
recognizer = cv.FaceRecognizerSF.create(
                model= modelPath,
                config="",
                #backend_id=0,
                #target_id=0
)


# Define the path to the folder containing images
folder_path = "images"
output_folder = "output"
# List all files in the folder
files = os.listdir(folder_path)
feat_dict = {}

# Filter out image files (you can add more extensions as needed)
image_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.gif', '.tiff']
image_files = [f for f in files if any(f.lower().endswith(ext) for ext in image_extensions)]

for image_file in image_files:
    image_path = os.path.join(folder_path, image_file)
    # print(f"Processing file: {image_path}")
    img = cv.imread(image_path)
    if img is None:
        print(f"Failed to load image: {image_path}")
        continue
    height, width, _ = img.shape
    face_detector.setInputSize((width, height))
    _, faces = face_detector.detect(img)
    faces = faces if faces is not None else []
    
    if len(faces) > 0:
        for face1 in faces:
            x, y, width, height = list(map(int, face1[:4]))
            x2, y2 = x + width, y + height
            cv.rectangle(img, (x, y), (x2, y2), (0, 0, 255), 4)
            face_img = img[y:y + height, x:x + width]
            face_filename = os.path.join(output_folder, f"{os.path.splitext(image_file)[0]}_face.jpg")
            # cv.imwrite(face_filename, face_img)
            
            aligned_face_img = recognizer.alignCrop(img, face1)
            feat_img = recognizer.feature(aligned_face_img)
            feat_dict[face_filename[7:-4]] = feat_img


# video face recognition
thresh = 0.5
# Open the video file
video_path = "videos/friends4.mp4"
cap = cv.VideoCapture(video_path)

# Check if the video was successfully opened
if not cap.isOpened():
    print("Error: Could not open video.")
    exit()
while True:
    ret, frame = cap.read()  # Read a single frame
    if not ret:
        break

    height, width, _ = frame.shape
    face_detector.setInputSize((width, height))
    detected_faces_cam = face_detector.detect(frame)

    if detected_faces_cam is not None and detected_faces_cam[1] is not None:
        for face in detected_faces_cam[1]:
            label = "unknown"
            x, y, width, height = list(map(int, face[:4]))
            x2, y2 = x + width, y + height
            face_img = frame[y:y + height, x:x + width]
            
            aligned_face_cam = recognizer.alignCrop(frame, face)
            feat_cam = recognizer.feature(aligned_face_cam)

            for face_name, feat_img in feat_dict.items(): 
                result = recognizer.match(feat_cam, feat_img, cv.FaceRecognizerSF_FR_COSINE)

                if result > thresh:
                    label = face_name
             
            cv.putText(frame, label, (x, y - 10), cv.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 0), 2, cv.LINE_AA)
            cv.rectangle(frame, (x, y), (x2, y2), (0, 0, 255), 4)

    cv.imshow("Output", frame)
    if cv.waitKey(1) & 0xFF == ord('q'):
        break


# real-time face recognition

video = cv.VideoCapture(0)

thresh = 0.5

if (video.isOpened() == False):
    print("Web Camera not detected")
while (True):
    ret, frame = video.read()
    if ret == True:
        height, width, _ = frame.shape
        face_detector.setInputSize((width, height))
        detected_faces_cam = face_detector.detect(frame)
        # print(type())
        if len(detected_faces_cam) > 0:
            for face in detected_faces_cam[1]:
                # max_score = 0
                label = "unknown"
                x, y, width, height = list(map(int, face[:4]))
                x2, y2 = x + width, y + height
                face_img = frame[y:y + height, x:x + width]
                print(type(face_img))
                aligned_face_cam = recognizer.alignCrop(frame, face) #aligned_img
                feat_cam = recognizer.feature(aligned_face_cam)
                for face_name, feat_img in feat_dict.items(): 
                    result = recognizer.match(feat_cam, feat_img, cv.FaceRecognizerSF_FR_COSINE)
                    print(face_name, result)

                    if result > thresh:
                        print('running')
                        # print(face_name, result, max_score)
                        label = face_name
                         

                cv.putText(frame, label, (x, y - 10), cv.FONT_HERSHEY_SIMPLEX, 0.9, (0, 200, 0), 2, cv.LINE_AA)
                # cv.putText(frame, f"Score: {thresh:.2f}", (x, y + height + 20), cv.FONT_HERSHEY_SIMPLEX, 0.9, (0, 255, 0), 2, cv.LINE_AA)
                cv.rectangle(frame, (x, y), (x2, y2), (0, 0, 255), 4)
        cv.imshow("Output",frame)
        if cv.waitKey(1) & 0xFF == ord('q'):
            break
    else:
        break

video.release()
cv.destroyAllWindows()

