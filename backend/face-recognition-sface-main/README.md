<p style="text-align:center">
<h1 style="text-align: center;">Face Recognition</h1>
</p>
<p align="center">
<img src="assets/icon.jpg" alt="face recognition" width="400" style="border-radius: 10px"/>
</p>


> This project demonstrates a face recognition pipeline using two pre-trained models:
> - **YuNet**: For face detection.
> - **SFace**: For face recognition.

> It includes functionalities for detecting and recognizing faces in images, videos, and real-time webcam streams.

## Features
- Detect faces in images and videos using the **YuNet face detection model**.
- Recognize faces using the **SFace face recognition model**.
- Log detected and recognized faces with bounding boxes in visual outputs.
- Supports **real-time face recognition** via webcam.

---

## Example output
The output includes detected and recognized faces highlighted in bounding boxes, with labels indicating the recognized names.

Watch the project in action:


![Face Recognition Demo](assets/demo.gif)

Alternatively, you can download and view the demo video directly from the repository:  
[Download Video](assets/demo_video.mp4)



## Utilities
The project provides practical tools for utilizing face recognition in various scenarios:

1. **Identity Verification**:
   - Use the model to verify a person’s identity by matching their face against a database of known faces.

2. **Attendance Tracking**:
   - Automate attendance systems by logging the presence of individuals in real-time.

3. **Access Control**:
   - Enhance security by allowing access to areas or systems based on recognized faces.

4. **Video Analytics**:
   - Detect and track faces in video feeds for analytics, monitoring, or event detection.

5. **Real-Time Alerts**:
   - Get instant alerts when a specific face is detected in a live video stream.

---

These utilities demonstrate how the model can be integrated into diverse applications like security systems, monitoring tools, and identity verification solutions.

---

Would you like to include code snippets or tutorials for implementing any of these utilities? For instance, a guide on how to use this model for attendance tracking or access control?



## Prerequisites
Before you begin, ensure you have the following installed:
- Python 3.12 or later
- OpenCV with ONNX support
- Anaconda (recommended)

---

## Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/elnazparsaei/FaceRecognition.git
   cd FaceRecognition
## Acknowledgments
This project leverages the following:

- [YuNet](https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet) for face detection.
- [SFace](https://github.com/opencv/opencv_zoo/tree/main/models/face_recognition_sface) for face recognition.


<h2 style="text-align: left;">Contact</h2>

If you have any question or issues, feel free to mail me: [elnazparsaei1994@gmail.com](elnazparsaei1994@gmail.com) or you can reach me on [LinkedIn](https://www.linkedin.com/in/elnaz-parsaei/).

