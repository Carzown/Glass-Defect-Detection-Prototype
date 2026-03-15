#!/usr/bin/env python3

import sys
import os
import cv2
import tempfile
import time

# Allow imports from modules and model folders
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "modules"))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "model"))

from camera import Camera
from preprocessing import Preprocessor
from scene_change import SceneChangeDetector
from defect_tracker import DefectTracker
from uploader import UploadManager
from device_status import DeviceStatus
from model_loader import ModelLoader


# Frame file for Tkinter preview
FRAME_PATH = os.path.join(tempfile.gettempdir(), "gdd_latest_frame.jpg")


def frame_generator(camera, preprocess):

    while True:

        frame = camera.capture()

        processed = preprocess.process(frame)

        yield processed


def main():

    print("\nSYSTEM READY LOCAL MODE")
    print("=" * 70)

    camera = Camera()
    preprocess = Preprocessor()
    scene_detector = SceneChangeDetector()
    tracker = DefectTracker()
    uploader = UploadManager()
    device_status = DeviceStatus()

    model = ModelLoader().load()

    device_status.set_online()

    try:

        for result in model.predict_batch(frame_generator(camera, preprocess)):

            annotated = result.image_overlay
            frame_for_scene = result.image

            if annotated is None:
                continue

            # Save frame for Tkinter preview
            cv2.imwrite(FRAME_PATH, annotated)

            # Scene change detection
            if scene_detector.detect(frame_for_scene):

                tracker.reset()

            # Process detections
            defects = tracker.process(result.results)

            if defects:

                uploader.upload_async(
                    annotated.copy(),
                    defects
                )

    except KeyboardInterrupt:

        pass

    finally:

        camera.stop()

        device_status.set_offline()

        cv2.destroyAllWindows()

        print("\nSystem Stopped")


if __name__ == "__main__":
    main()
