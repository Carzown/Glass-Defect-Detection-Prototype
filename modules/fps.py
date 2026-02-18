import cv2
import time

class FPS:
    """FPS counter and drawer for OpenCV frames"""
    
    def __init__(self):
        self.start_time = time.time()
        self.frame_count = 0
        self.fps = 0.0
    
    def update(self):
        """Update frame count and calculate FPS"""
        self.frame_count += 1
        elapsed = time.time() - self.start_time
        if elapsed > 0:
            self.fps = self.frame_count / elapsed
    
    def draw(self, frame):
        """Draw FPS counter on frame"""
        text = f"FPS: {self.fps:.1f}"
        cv2.putText(
            frame,
            text,
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (0, 255, 0),
            2
        )
        return frame
