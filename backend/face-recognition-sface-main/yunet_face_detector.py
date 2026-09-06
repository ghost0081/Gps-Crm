import cv2
import os
import pickle

class YuNetFaceDetector:

    def __init__(self, weight_directory, score_threshold=0.65):
        self.score_threshold = score_threshold
        self.weight_directory = weight_directory

    def take_photo(self, image_directory):
        directory = self.create_directory(image_directory)

        # names = self.load_pickle(directory)
        names = self.face_lists(image_directory)

        cam = cv2.VideoCapture(0)
        cam.set(3, 640)
        cam.set(4, 480)

        while True:
            face_name = input('\nEnter user name and press <Enter> :  ')
            if face_name.lower() in names:
                print("The name you entered is exists!")
            else:
                break

        face_id = self.get_face_id(directory)
        # names[face_id] = face_name

        # encoding_directory = os.path.normpath(directory + os.sep + os.pardir)
        # with open(f"{encoding_directory}/encoding/encoding.pickle", 'wb') as file:
        #     pickle.dump(names, file)

        print('\nInitializing face capture. Look at the camera and wait...')

        take_photo = False
        while not take_photo:
            ret, img = cam.read()
            img = self.image_preprocess(img)

            weights_path = self.weight_directory
            face_detector = cv2.FaceDetectorYN.create(weights_path, "", (0, 0))
            face_detector.setScoreThreshold(0.9)#!!!
            height, width, _ = img.shape
            face_detector.setInputSize((width, height))
            _, faces = face_detector.detect(img)

            if faces is not None:
                cv2.imshow('image', img)
                cv2.imwrite(f'{directory}/{face_id}-{face_name}.jpg', img)
                take_photo = True

        print('\nSuccess! Exiting Program.')
        cam.release()
        cv2.destroyAllWindows()

    def detect(self, image):
        if type(image) == str:
            image = cv2.imread(image)
        weights_path = self.weight_directory

        # box_list = []
        ################################################################################################
        face_detector = cv2.FaceDetectorYN.create(weights_path, "", (960, 720))
        face_detector.setScoreThreshold(self.score_threshold)
        height, width, _ = image.shape
        face_detector.setInputSize((width, height))
        _, faces = face_detector.detect(image)
        faces = faces if faces is not None else []
        ################################################################################################
        # if len(results):
        #     for res in results:
        #         # box = list(map(int, res[:4]))
        #         box_list.append(res)

        return faces


if __name__ == "__main__":
    face_detector = YuNetFaceDetector("data/models/face_detection_yunet_2023mar.onnx")
    # face_detector.get_photo(face_name="Rigi", image_path="images/rigi.jpg",
    #                          output_directory="data/train_images")
    face_detector.take_photo(image_directory="data/train_images")
    # print(len(face_detector.detect("data/test_images/test.jpg")))

