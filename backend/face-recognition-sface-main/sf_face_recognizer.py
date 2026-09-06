from yunet_face_detector import YuNetFaceDetector
# from mtcnn_face_detector import MtcnnFaceDetector

import os
import sys
import glob
# import time
import cv2
from tqdm import tqdm


COSINE_THRESHOLD = 0.363
# COSINE_THRESHOLD = 0.34
# COSINE_THRESHOLD = 0.275
# COSINE_THRESHOLD = 0.277
# COSINE_THRESHOLD = 0.212


class FaceRecognizerSF:

    def __init__(self, face_detector, weight_directory):
        self.face_detector = face_detector
        self.weight_directory = weight_directory
        self.face_recognizer = cv2.FaceRecognizerSF.create(
            self.weight_directory, "")

    def match(self, recognizer, feature1, dictionary):
        max_score = 0.0
        sim_user_id = ""
        for user_id, feature2 in zip(dictionary.keys(), dictionary.values()):
            score = recognizer.match(
                feature1, feature2, cv2.FaceRecognizerSF_FR_COSINE)
            if score >= max_score:
                max_score = score
                sim_user_id = user_id
        if max_score < COSINE_THRESHOLD:
            return False, ("", 0.0)
        return True, (sim_user_id, max_score)

    def extract_features(self, image, file_name=None):
        faces = self.face_detector.detect(image)
        features = []
        for face in faces:
            aligned_face = self.face_recognizer.alignCrop(image, face)
            feat = self.face_recognizer.feature(aligned_face)
            features.append(feat)

        return features, faces

    def train(self, faces_directory):
        dictionary = {}
        types = ('*.jpg', '*.png', '*.jpeg', '*.JPG', '*.PNG', '*.JPEG')
        files = []
        for a_type in types:
            files.extend(glob.glob(os.path.join(faces_directory, a_type)))
        files = list(set(files))

        for file in tqdm(files):
            image = cv2.imread(file)
            image = cv2.resize(image, dsize=(960, 720), interpolation=cv2.INTER_CUBIC)
            feats, faces = self.extract_features(image)
            if faces is None:
                continue
            user_id = os.path.splitext(os.path.basename(file))[0]
            dictionary[user_id] = feats[0]
        print(f'there are {len(dictionary)} ids')
        return dictionary

    def draw_box(self, image, faces, features, dictionary):
        for idx, (face, feature) in enumerate(zip(faces, features)):
            result, user = self.match(
                self.face_recognizer, feature, dictionary)
            box = list(map(int, face[:4]))
            color = (0, 255, 0) if result else (0, 0, 255)
            thickness = 2
            cv2.rectangle(image, box, color, thickness, cv2.LINE_AA)

            id_name, score = user if result else (f"unknown_{idx}", 0.0)
            text = "{0} ({1:.2f})".format(id_name, score)
            position = (box[0], box[1] - 10)
            font = cv2.FONT_HERSHEY_SIMPLEX
            scale = 0.6
            cv2.putText(image, text, position, font, scale,
                        color, thickness, cv2.LINE_AA)

    def recognize(self, image, faces_directory):
        dictionary = self.train(faces_directory)
        if type(image) is str:
            image = cv2.imread(image)
        features, faces = self.extract_features(image)
        self.draw_box(image, faces, features, dictionary)
        cv2.imshow("face recognition", image)
        cv2.waitKey(0)
        return image

    def real_time_recognization(self, faces_directory):
        dictionary = self.train(faces_directory)
        capture = cv2.VideoCapture(0)
        if not capture.isOpened():
            sys.exit()

        cv2.namedWindow("face recognition")
        
        while True:
            result, image = capture.read()
            image = cv2.resize(image, dsize=(960, 720), interpolation=cv2.INTER_CUBIC)
            if result is False:
                cv2.waitKey(0)
                break
            features, faces = self.extract_features(image)
            if faces is None:
                continue
            self.draw_box(image, faces, features, dictionary)

            cv2.imshow("face recognition", image)
            key = cv2.waitKey(1)
            if key == ord('q'):
                break
            cv2.resizeWindow("face recognition", 960, 720) 
        cv2.destroyAllWindows()


if __name__ == "__main__":
    face_detector = YuNetFaceDetector("data/models/face_detection_yunet_2023mar.onnx")
    # face_detector = MtcnnFaceDetector()
    face_recognizer = FaceRecognizerSF(weight_directory="data/models/face_recognizer_fast.onnx",
                                       face_detector=face_detector)
    # face_recognizer.train("images")
    # face_recognizer.recognize("data/test_images/test.jpg", faces_directory="data/train_images")
    face_recognizer.real_time_recognization(faces_directory="data/train_images")
